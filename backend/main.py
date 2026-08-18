from __future__ import annotations

import asyncio
import hashlib
import hmac
import io
import json
import os
import threading
from datetime import datetime, timezone
from typing import Any, List

import requests
from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, File, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from pydantic import BaseModel
from starlette.middleware.sessions import SessionMiddleware

from document_ingestion import apply_classification_choice, ingest_and_index_document
from document_pipeline import MAX_FILE_BYTES, detect_mime_type
from drive_search import (
    find_folder_match,
    get_owned_file,
    record_search_feedback,
    search_files_in_db,
    should_send_directly,
)
from folder_creator import append_folders_to_drive, build_drive_structure
from google.auth.exceptions import RefreshError
from googleapiclient.errors import HttpError
from Interative_List import send_interactive_list
from syllabus_parser import parse_syllabus
from supabase_client import supabase


load_dotenv()

META_TOKEN = os.getenv("META_TOKEN")
PHONE_NUMBER_ID = os.getenv("PHONE_NUMBER_ID")
VERIFY_TOKEN = os.getenv("VERIFY_TOKEN")
META_APP_SECRET = os.getenv("META_APP_SECRET")
ALLOW_UNSIGNED_WEBHOOKS = os.getenv("ALLOW_UNSIGNED_WEBHOOKS", "false").lower() == "true"
META_GRAPH_VERSION = os.getenv("META_GRAPH_VERSION", "v17.0")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
REQUEST_TIMEOUT = (10, 60)

if not META_TOKEN or not PHONE_NUMBER_ID:
    raise ValueError("Missing META_TOKEN or PHONE_NUMBER_ID in the backend environment")

app = FastAPI()
app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("SESSION_SECRET", "local-development-only-change-me"),
    max_age=3600,
    same_site="none",
    https_only=True,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(dict.fromkeys([
        FRONTEND_URL,
        "http://localhost:5173",
        "http://localhost:3000",
    ])),
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


class SubjectItem(BaseModel):
    name: str
    units: List[str] = []


class CreateFoldersRequest(BaseModel):
    subjects: List[SubjectItem]


def _meta_url(resource: str) -> str:
    return f"https://graph.facebook.com/{META_GRAPH_VERSION}/{resource.lstrip('/')}"


def _meta_headers(*, json_content: bool = False) -> dict[str, str]:
    headers = {"Authorization": f"Bearer {META_TOKEN}"}
    if json_content:
        headers["Content-Type"] = "application/json"
    return headers


def send_message(to: str, text: str) -> bool:
    try:
        response = requests.post(
            _meta_url(f"{PHONE_NUMBER_ID}/messages"),
            headers=_meta_headers(json_content=True),
            json={
                "messaging_product": "whatsapp",
                "to": to,
                "type": "text",
                "text": {"body": text[:4096]},
            },
            timeout=REQUEST_TIMEOUT,
        )
        response.raise_for_status()
        return True
    except requests.RequestException as exc:
        print(f"WhatsApp text send failed: {exc}")
        return False


def send_buttons(to: str, text: str, buttons: list[dict[str, str]]) -> bool:
    safe_buttons = [
        {
            "type": "reply",
            "reply": {"id": button["id"][:256], "title": button["title"][:20]},
        }
        for button in buttons[:3]
    ]
    try:
        response = requests.post(
            _meta_url(f"{PHONE_NUMBER_ID}/messages"),
            headers=_meta_headers(json_content=True),
            json={
                "messaging_product": "whatsapp",
                "to": to,
                "type": "interactive",
                "interactive": {
                    "type": "button",
                    "body": {"text": text[:1024]},
                    "action": {"buttons": safe_buttons},
                },
            },
            timeout=REQUEST_TIMEOUT,
        )
        response.raise_for_status()
        return True
    except requests.RequestException as exc:
        print(f"WhatsApp button send failed: {exc}")
        return False


def get_drive_service(refresh_token: str):
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
    if not client_id or not client_secret:
        raise ValueError("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET")
    credentials = Credentials(
        None,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=client_id,
        client_secret=client_secret,
    )
    return build("drive", "v3", credentials=credentials)


def download_drive_file(refresh_token: str, file_id: str) -> io.BytesIO | None:
    try:
        request = get_drive_service(refresh_token).files().get_media(fileId=file_id)
        file_data = io.BytesIO()
        downloader = MediaIoBaseDownload(file_data, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()
        file_data.seek(0)
        return file_data
    except Exception as exc:
        print(f"Drive download failed: {exc}")
        return None


def upload_to_whatsapp(file_bytes: io.BytesIO, mime_type: str, filename: str) -> str | None:
    try:
        response = requests.post(
            _meta_url(f"{PHONE_NUMBER_ID}/media"),
            headers=_meta_headers(),
            files={"file": (filename, file_bytes, mime_type)},
            data={"messaging_product": "whatsapp"},
            timeout=REQUEST_TIMEOUT,
        )
        response.raise_for_status()
        return response.json().get("id")
    except requests.RequestException as exc:
        print(f"WhatsApp media upload failed: {exc}")
        return None


def _drive_item_in_root(service, file_id: str, root_id: str, max_depth: int = 12) -> bool:
    """Validate ancestry before accepting a Drive ID supplied by an interaction."""
    if file_id == root_id:
        return True
    frontier = [file_id]
    visited: set[str] = set()
    for _ in range(max_depth):
        next_frontier: list[str] = []
        for current_id in frontier:
            if current_id in visited:
                continue
            visited.add(current_id)
            try:
                metadata = service.files().get(fileId=current_id, fields="id, parents, trashed").execute()
            except Exception:
                continue
            if metadata.get("trashed"):
                continue
            parents = metadata.get("parents") or []
            if root_id in parents:
                return True
            next_frontier.extend(parents)
        if not next_frontier:
            return False
        frontier = next_frontier
    return False


def trigger_file_send(to_number: str, user: dict[str, Any], drive_file_id: str, filename: str) -> bool:
    refresh_token = user["google_token"]["refresh_token"]
    service = get_drive_service(refresh_token)
    if not get_owned_file(user["id"], drive_file_id=drive_file_id):
        if not _drive_item_in_root(service, drive_file_id, user["root_folder_id"]):
            send_message(to_number, "This file is not inside your DocsFlow workspace.")
            return False

    file_bytes = download_drive_file(refresh_token, drive_file_id)
    if not file_bytes:
        send_message(to_number, "I could not download that file from Drive.")
        return False
    payload = file_bytes.getvalue()
    mime_type = detect_mime_type(payload, None, filename)
    message_type = "image" if mime_type.startswith("image/") else "document"
    media_id = upload_to_whatsapp(io.BytesIO(payload), mime_type, filename)
    if not media_id:
        send_message(to_number, "I could not prepare that file for WhatsApp.")
        return False

    media_body: dict[str, Any] = {"id": media_id}
    if message_type == "document":
        media_body.update({"filename": filename, "caption": f"Document: {filename}"})
    try:
        response = requests.post(
            _meta_url(f"{PHONE_NUMBER_ID}/messages"),
            headers=_meta_headers(json_content=True),
            json={
                "messaging_product": "whatsapp",
                "to": to_number,
                "type": message_type,
                message_type: media_body,
            },
            timeout=REQUEST_TIMEOUT,
        )
        response.raise_for_status()
        return True
    except requests.RequestException as exc:
        print(f"WhatsApp file send failed: {exc}")
        send_message(to_number, "I could not send that file right now.")
        return False


def list_drive_folder(refresh_token: str, folder_id: str) -> list[dict[str, Any]]:
    try:
        response = get_drive_service(refresh_token).files().list(
            q=f"'{folder_id}' in parents and trashed=false",
            pageSize=10,
            fields="files(id, name, mimeType)",
            orderBy="folder,name",
        ).execute()
        return response.get("files", [])
    except Exception as exc:
        print(f"Drive folder listing failed: {exc}")
        return []


def _authenticated_user_id(request: Request) -> str | None:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    try:
        response = supabase.auth.get_user(auth_header.removeprefix("Bearer ").strip())
        return response.user.id if response.user else None
    except Exception:
        return None


@app.get("/")
async def health_check():
    return {
        "status": "online",
        "message": "DocsFlow backend is running",
        "document_intelligence": "local",
    }


@app.get("/api/drive/browse")
async def browse_drive(request: Request, folder_id: str):
    user_id = _authenticated_user_id(request)
    if not user_id:
        return Response("Invalid or missing token", status_code=401)

    profile_response = (
        supabase.table("profiles")
        .select("google_token, root_folder_id")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    if not profile_response.data:
        return Response("Profile not found", status_code=404)
    profile = profile_response.data[0]
    google_data = profile.get("google_token") or {}
    root_folder_id = profile.get("root_folder_id")
    if not google_data.get("refresh_token") or not root_folder_id:
        return Response("Google Drive is not linked", status_code=400)

    try:
        service = get_drive_service(google_data["refresh_token"])
        if not _drive_item_in_root(service, folder_id, root_folder_id):
            return JSONResponse({"error": "FOLDER_NOT_OWNED"}, status_code=403)

        metadata = service.files().get(fileId=folder_id, fields="id, name, trashed").execute()
        if metadata.get("trashed"):
            raise _DriveItemGone("Folder is in trash")
        response = service.files().list(
            q=f"'{folder_id}' in parents and trashed=false",
            pageSize=100,
            fields="files(id, name, mimeType, webViewLink)",
            orderBy="folder,name",
        ).execute()
    except RefreshError:
        # An expired or revoked token says nothing about whether the folder exists.
        # Treating it as a deletion previously wiped the user's whole folder mapping.
        print(f"Drive authorisation expired for {user_id}; asking the user to reconnect")
        return JSONResponse({"error": "DRIVE_REAUTH_REQUIRED"}, status_code=401)
    except (_DriveItemGone, HttpError) as exc:
        gone = isinstance(exc, _DriveItemGone) or getattr(getattr(exc, "resp", None), "status", None) in (404, 410)
        if not gone:
            print(f"Drive unavailable while browsing {folder_id}: {exc}")
            return JSONResponse({"error": "DRIVE_UNAVAILABLE"}, status_code=503)
        if folder_id == root_folder_id:
            # Only clear the root pointer. folder_map is left alone so it can still be
            # reconciled, and it is replaced wholesale when a new tree is built.
            supabase.table("profiles").update({
                "status": "CONNECTED",
                "root_folder_id": None,
            }).eq("id", user_id).execute()
            return JSONResponse({"error": "ROOT_DELETED"}, status_code=404)
        return JSONResponse({"error": "FOLDER_DELETED"}, status_code=404)
    except Exception as exc:
        print(f"Unexpected Drive error while browsing {folder_id}: {exc}")
        return JSONResponse({"error": "DRIVE_UNAVAILABLE"}, status_code=503)

    folders, files = [], []
    for item in response.get("files", []):
        clean_item = {
            "id": item["id"],
            "name": item["name"],
            "mimeType": item["mimeType"],
            "link": item.get("webViewLink"),
        }
        if item["mimeType"] == "application/vnd.google-apps.folder":
            folders.append(clean_item)
        else:
            files.append(clean_item)
    return {"folders": folders, "files": files}


class _DriveItemGone(Exception):
    """The Drive item genuinely no longer exists, as opposed to being unreachable."""


def _sanitized_folder_map(existing_map: dict[str, Any] | None) -> dict[str, Any]:
    """Keep only folder_map entries that carry a real Drive folder id.

    folder_map must be {subject: {"id": ..., "units": {name: id}}}. Anything else cannot
    be used for classification or retrieval, so it is dropped rather than propagated.
    """
    cleaned: dict[str, Any] = {}
    for name, data in (existing_map or {}).items():
        if not isinstance(data, dict) or not data.get("id"):
            print(f"Dropping malformed folder_map entry for {name!r}")
            continue
        raw_units = data.get("units")
        units = (
            {str(unit): str(folder_id) for unit, folder_id in raw_units.items() if folder_id}
            if isinstance(raw_units, dict)
            else {}
        )
        cleaned[str(name)] = {"id": str(data["id"]), "units": units}
    return cleaned


async def run_folder_creation_worker(
    user_id: str,
    phone: str,
    refresh_token: str,
    structure: dict[str, list[str]],
    root_id: str | None = None,
    existing_map: dict[str, Any] | None = None,
):
    try:
        if root_id:
            # Only trust entries that actually carry a Drive folder id. A malformed entry
            # would otherwise be merged forward and permanently corrupt the live map.
            safe_existing = _sanitized_folder_map(existing_map)
            items_to_add = {name: units for name, units in structure.items() if name not in safe_existing}
            new_map = append_folders_to_drive(refresh_token, root_id, items_to_add) if items_to_add else {}
            if items_to_add and not new_map:
                raise RuntimeError("Drive rejected every folder creation")
            final_map = {**safe_existing, **new_map}
            final_root_id = root_id
        else:
            final_root_id, final_map = build_drive_structure(refresh_token, structure, folder_name_suffix=phone)
            # Never persist a failed build. Writing an empty map with a null root used to
            # leave the account looking ACTIVE while being completely unusable.
            if not final_root_id or not final_map:
                raise RuntimeError("Drive folder creation returned nothing")

        supabase.table("profiles").update({
            "folder_map": final_map,
            "root_folder_id": final_root_id,
            "status": "ACTIVE",
        }).eq("id", user_id).execute()
        send_message(phone, "Your DocsFlow folders are ready. Send me a document whenever you like.")
    except RefreshError:
        print(f"Drive authorisation expired for {user_id}; folder creation aborted")
        supabase.table("profiles").update({"status": "CONNECTED"}).eq("id", user_id).execute()
        send_message(
            phone,
            "I lost access to your Google Drive. Please reconnect it on the DocsFlow website, "
            "then try creating your folders again.",
        )
    except Exception as exc:
        print(f"Folder creation failed for {user_id}: {exc}")
        send_message(phone, "I could not finish creating your folders. Please try again from the website.")


@app.post("/create-folders")
async def create_folders_web(request: Request, background_tasks: BackgroundTasks):
    user_id = _authenticated_user_id(request)
    if not user_id:
        return Response("Invalid or missing token", status_code=401)
    try:
        body = await request.json()
        structure = {
            item["name"].strip(): [unit.strip() for unit in item.get("units", []) if unit.strip()]
            for item in body.get("subjects", [])
            if item.get("name", "").strip()
        }
        profile_response = supabase.table("profiles").select(
            "id, phone, google_token, root_folder_id, folder_map"
        ).eq("id", user_id).limit(1).execute()
        if not profile_response.data:
            return Response("Profile not found", status_code=404)
        user = profile_response.data[0]
        google_data = user.get("google_token") or {}
        if not google_data.get("refresh_token"):
            return Response("Google Drive is not linked", status_code=400)

        if not user.get("root_folder_id"):
            defaults = {
                "Important Documents": ["Aadhar Card", "PAN Card"],
                "Screenshots": [],
                "Identity Cards": [],
                "Personal": [],
                "Imported Documents": [],
            }
            # Only fall back to the defaults when the caller supplied nothing. Merging them
            # over an explicit structure meant a folder the user deliberately removed came
            # straight back, so the setup screen could not really be customised.
            structure = structure or dict(defaults)
            # The pipeline files anything it cannot place into this folder, so it has to
            # exist regardless of what the user chose.
            structure.setdefault("Imported Documents", [])

        background_tasks.add_task(
            run_folder_creation_worker,
            user_id,
            user.get("phone"),
            google_data["refresh_token"],
            structure,
            user.get("root_folder_id"),
            user.get("folder_map") or {},
        )
        return {"status": "processing", "message": "Creation started"}
    except Exception as exc:
        print(f"Create folders failed: {exc}")
        return JSONResponse({"error": "Could not create folders"}, status_code=500)


@app.post("/api/upload-syllabus")
async def upload_syllabus(request: Request, file: UploadFile = File(...)):
    user_id = _authenticated_user_id(request)
    if not user_id:
        return JSONResponse({"error": "Invalid or missing token"}, status_code=401)
    try:
        file_content = await file.read()
        if len(file_content) > MAX_FILE_BYTES:
            return JSONResponse({"error": "Syllabus file is too large"}, status_code=413)
        subjects = await asyncio.to_thread(
            parse_syllabus,
            file_content,
            file.content_type,
            file.filename or "syllabus.pdf",
        )
        if not subjects:
            return JSONResponse({
                "error": "No clear subject/unit headings were found. Add subjects manually or upload a clearer syllabus.",
            }, status_code=400)
        # This is only a preview for the user to edit. It must never be written to
        # profiles.folder_map: that column holds live Drive folder IDs, and overwriting it
        # with parsed names destroys the mapping to the user's actual folders. The map is
        # only updated by run_folder_creation_worker, after folders really exist.
        return {"success": True, "subjects": subjects}
    except Exception as exc:
        print(f"Local syllabus parsing failed: {exc}")
        return JSONResponse({"error": "Could not parse this syllabus"}, status_code=500)


def verify_meta_signature(raw_body: bytes, supplied_signature: str | None) -> bool:
    if not META_APP_SECRET:
        return ALLOW_UNSIGNED_WEBHOOKS
    if not supplied_signature or not supplied_signature.startswith("sha256="):
        return False
    expected = "sha256=" + hmac.new(
        META_APP_SECRET.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, supplied_signature)


def get_meta_media(media_id: str) -> tuple[bytes | None, str | None]:
    try:
        info_response = requests.get(
            _meta_url(media_id),
            headers=_meta_headers(),
            timeout=REQUEST_TIMEOUT,
        )
        info_response.raise_for_status()
        media_info = info_response.json()
        media_url = media_info.get("url")
        if not media_url:
            return None, None
        media_response = requests.get(
            media_url,
            headers=_meta_headers(),
            timeout=REQUEST_TIMEOUT,
        )
        media_response.raise_for_status()
        if len(media_response.content) > MAX_FILE_BYTES:
            raise ValueError(f"Media exceeds the {MAX_FILE_BYTES // (1024 * 1024)} MB limit")
        return media_response.content, media_info.get("mime_type")
    except Exception as exc:
        print(f"Meta media download failed: {exc}")
        return None, None


def _claim_ingestion_job(job_id: str | None = None) -> dict[str, Any] | None:
    response = supabase.rpc("claim_ingestion_job", {"p_job_id": job_id}).execute()
    return response.data[0] if response.data else None


def _renew_ingestion_lease(job_id: str, lease_token: str) -> bool:
    try:
        response = supabase.rpc("renew_ingestion_lease", {
            "p_job_id": job_id,
            "p_lease_token": lease_token,
            "p_minutes": 30,
        }).execute()
        return response.data is True
    except Exception as exc:
        print(f"Could not renew ingestion lease for {job_id}: {exc}")
        return False


def _lease_heartbeat(stop_event: threading.Event, lost_event: threading.Event, job_id: str, lease_token: str) -> None:
    while not stop_event.wait(60):
        if not _renew_ingestion_lease(job_id, lease_token):
            lost_event.set()
            return


def _process_claimed_ingestion_job(job: dict[str, Any]) -> None:
    job_id = job["id"]
    lease_token = job.get("lease_token")
    stop_heartbeat = threading.Event()
    lease_lost = threading.Event()
    heartbeat = threading.Thread(
        target=_lease_heartbeat,
        args=(stop_heartbeat, lease_lost, job_id, lease_token),
        daemon=True,
    )
    heartbeat.start()

    def lease_guard() -> bool:
        return not lease_lost.is_set() and _renew_ingestion_lease(job_id, lease_token)

    try:
        profile_response = supabase.table("profiles").select(
            "id, phone, google_token, root_folder_id, folder_map, status"
        ).eq("id", job["user_id"]).limit(1).execute()
        if not profile_response.data:
            raise ValueError("Profile disappeared before ingestion")
        user = profile_response.data[0]
        data, claimed_mime_type = get_meta_media(job["media_id"])
        if not data:
            raise ValueError("WhatsApp media could not be downloaded")

        outcome = ingest_and_index_document(
            user=user,
            data=data,
            claimed_mime_type=claimed_mime_type,
            original_filename=job["original_filename"],
            ingestion_job_id=job_id,
            lease_guard=lease_guard,
        )
        final_status = "needs_confirmation" if outcome.classification_status == "needs_confirmation" else "completed"
        completion = supabase.table("ingestion_jobs").update({
            "status": final_status,
            "file_id": outcome.file_id,
            "drive_file_id": outcome.drive_file_id,
            "lease_token": None,
            "lease_expires_at": None,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "completed_at": datetime.now(timezone.utc).isoformat() if final_status == "completed" else None,
        }).eq("id", job_id).eq("lease_token", lease_token).execute()
        if not completion.data:
            return

        if outcome.duplicate:
            send_message(job["sender"], f"This file is already saved as {outcome.file_name} in {outcome.folder_label}.")
        elif outcome.extraction_status not in {"complete", "visual_only"}:
            send_message(
                job["sender"],
                f"Saved {outcome.file_name} in Imported Documents, but I could not read searchable text from it. You can still find it by filename.",
            )
        elif outcome.classification_status == "needs_confirmation" and outcome.alternatives:
            buttons = [
                {
                    "id": f"CLASSIFY:{outcome.file_id}:{index}",
                    "title": candidate["label"].split(" / ")[-1],
                }
                for index, candidate in enumerate(outcome.alternatives[:2])
            ]
            buttons.append({"id": f"CLASSIFY_KEEP:{outcome.file_id}", "title": "Keep imported"})
            send_buttons(
                job["sender"],
                f"Saved {outcome.file_name} safely in Imported Documents. Which folder fits best?",
                buttons,
            )
        else:
            keywords = ", ".join(outcome.keywords[:5]) or "searchable content"
            send_message(
                job["sender"],
                f"Saved {outcome.file_name} in {outcome.folder_label}.\nIndexed: {keywords}",
            )
    except Exception as exc:
        print(f"Ingestion attempt failed for {job_id}: {exc}")
        failure = supabase.table("ingestion_jobs").update({
            "status": "failed",
            "last_error": str(exc)[:1000],
            "lease_token": None,
            "lease_expires_at": None,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", job_id).eq("lease_token", lease_token).execute()
        if failure.data and int(job.get("attempt_count") or 0) >= 3:
            send_message(job["sender"], "I could not process that file after several attempts. Please resend it.")
    finally:
        stop_heartbeat.set()
        heartbeat.join(timeout=2)


async def process_ingestion_job(job_id: str | None = None) -> bool:
    job = await asyncio.to_thread(_claim_ingestion_job, job_id)
    if not job:
        return False
    await asyncio.to_thread(_process_claimed_ingestion_job, job)
    return True


def enqueue_ingestion_job(
    user_id: str,
    sender: str,
    message_id: str,
    media_id: str,
    message_type: str,
    original_filename: str,
) -> str | None:
    existing = (
        supabase.table("ingestion_jobs")
        .select("id, status")
        .eq("meta_message_id", message_id)
        .limit(1)
        .execute()
    )
    if existing.data:
        existing_job = existing.data[0]
        return existing_job["id"] if existing_job["status"] in {"queued", "processing", "failed"} else None
    inserted = supabase.table("ingestion_jobs").insert({
        "user_id": user_id,
        "meta_message_id": message_id,
        "sender": sender,
        "media_id": media_id,
        "message_type": message_type,
        "original_filename": original_filename,
        "status": "queued",
    }).execute().data
    return inserted[0]["id"] if inserted else None


async def _ingestion_worker_loop() -> None:
    while True:
        try:
            processed_any = False
            for _ in range(10):
                processed = await process_ingestion_job()
                if not processed:
                    break
                processed_any = True
            await asyncio.sleep(1 if processed_any else 5)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            print(f"Ingestion worker loop failed: {exc}")
            await asyncio.sleep(5)


@app.on_event("startup")
async def start_ingestion_worker():
    asyncio.create_task(_ingestion_worker_loop())


def _profile_for_phone(sender: str) -> dict[str, Any] | None:
    response = supabase.table("profiles").select(
        "id, phone, status, whatsapp_verified, google_token, root_folder_id, folder_map"
    ).eq("phone", sender).limit(2).execute()
    if len(response.data or []) != 1:
        if response.data:
            print("Rejected ambiguous phone-to-profile mapping")
        return None
    return response.data[0]


def _handle_text_search(sender: str, user: dict[str, Any], query: str) -> None:
    query = " ".join((query or "").split()).strip()
    if len(query) < 2:
        send_message(sender, "Tell me a filename, topic, subject, date, or phrase from the document.")
        return

    folder_match = find_folder_match(user, query)
    if folder_match and folder_match["type"] == "SUBJECT":
        menu_items = [
            {"id": f"BROWSE:{unit_id}", "title": unit_name, "description": "Unit folder"}
            for unit_name, unit_id in folder_match["children"].items()
        ]
        menu_items.append({
            "id": f"BROWSE:{folder_match['id']}",
            "title": "All files",
            "description": f"Everything in {folder_match['name']}",
        })
        send_interactive_list(sender, f"{folder_match['name']} — choose a folder:", "Open", menu_items)
        return

    if folder_match and folder_match["type"] == "UNIT":
        files = (
            supabase.table("files")
            .select("id, drive_file_id, file_name, subject")
            .eq("user_id", user["id"])
            .eq("folder_id", folder_match["id"])
            .order("created_at", desc=True)
            .limit(9)
            .execute()
            .data
        )
        if not files:
            link = f"https://drive.google.com/drive/u/0/folders/{folder_match['id']}"
            send_message(sender, f"{folder_match['name']} is empty.\n{link}")
            return
        items = [
            {
                "id": f"FILEID:{row['id']}",
                "title": row["file_name"],
                "description": row.get("subject") or "Document",
            }
            for row in files
        ]
        items.append({
            "id": f"FOLDERLINK:{folder_match['id']}",
            "title": "Drive link",
            "description": "Open this folder in Drive",
        })
        send_interactive_list(sender, f"{folder_match['name']} ({len(files)} files):", "Select file", items)
        return

    results = search_files_in_db(user["id"], query, limit=10)
    if not results:
        record_search_feedback(user["id"], query, [], feedback_type="not_found")
        send_message(sender, f"I could not find a confident match for “{query}”. Try a filename, topic, or phrase inside the file.")
        return

    if should_send_directly(results):
        result = results[0]
        if trigger_file_send(sender, user, result["drive_file_id"], result["file_name"]):
            record_search_feedback(user["id"], query, results, result.get("id"))
        return

    items = []
    for result in results:
        description = result.get("subject") or result.get("document_type") or "Document"
        items.append({
            "id": f"FILEID:{result['id']}",
            "title": result["file_name"],
            "description": description,
        })
    send_interactive_list(
        sender,
        f"I found {len(results)} possible matches for “{query}”. Choose one:",
        "View matches",
        items,
    )


def _handle_interaction(sender: str, user: dict[str, Any], interaction: dict[str, Any]) -> None:
    interaction_type = interaction.get("type")
    if interaction_type == "button_reply":
        reply = interaction.get("button_reply") or {}
        selected_id = reply.get("id", "")
        selected_title = reply.get("title", "")
    elif interaction_type == "list_reply":
        reply = interaction.get("list_reply") or {}
        selected_id = reply.get("id", "")
        selected_title = reply.get("title", "")
    else:
        return

    if selected_id.startswith("CLASSIFY:"):
        _, file_id, raw_index = selected_id.split(":", 2)
        try:
            label = apply_classification_choice(user, file_id, int(raw_index))
            supabase.table("ingestion_jobs").update({
                "status": "completed",
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }).eq("file_id", file_id).eq("user_id", user["id"]).execute()
            send_message(sender, f"Moved it to {label}. I’ll use this correction for future organization.")
        except Exception as exc:
            print(f"Classification correction failed: {exc}")
            send_message(sender, "That folder choice is no longer available.")
        return

    if selected_id.startswith("CLASSIFY_KEEP:"):
        file_id = selected_id.removeprefix("CLASSIFY_KEEP:")
        owned = get_owned_file(user["id"], file_id=file_id)
        if owned:
            supabase.table("files").update({"classification_status": "user_confirmed"}).eq(
                "id", file_id
            ).eq("user_id", user["id"]).execute()
            supabase.table("ingestion_jobs").update({
                "status": "completed",
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }).eq("file_id", file_id).eq("user_id", user["id"]).execute()
            send_message(sender, "Kept it in Imported Documents.")
        return

    if selected_id.startswith("BROWSE:"):
        folder_id = selected_id.removeprefix("BROWSE:")
        service = get_drive_service(user["google_token"]["refresh_token"])
        if not _drive_item_in_root(service, folder_id, user["root_folder_id"]):
            send_message(sender, "That folder is not inside your DocsFlow workspace.")
            return
        items = list_drive_folder(user["google_token"]["refresh_token"], folder_id)
        if not items:
            send_message(sender, "This folder is empty.")
            return
        menu_items = [
            {
                "id": f"BROWSE:{item['id']}" if item["mimeType"] == "application/vnd.google-apps.folder" else f"DRIVEFILE:{item['id']}",
                "title": item["name"],
                "description": "Folder" if item["mimeType"] == "application/vnd.google-apps.folder" else "Document",
            }
            for item in items
        ]
        send_interactive_list(sender, f"Contents of {selected_title}:", "Open", menu_items)
        return

    if selected_id.startswith("FILEID:"):
        file_id = selected_id.removeprefix("FILEID:")
        owned = get_owned_file(user["id"], file_id=file_id)
        if not owned:
            send_message(sender, "That file is no longer available.")
            return
        trigger_file_send(sender, user, owned["drive_file_id"], owned["file_name"])
        return

    if selected_id.startswith("DRIVEFILE:"):
        drive_file_id = selected_id.removeprefix("DRIVEFILE:")
        trigger_file_send(sender, user, drive_file_id, selected_title or "document")
        return

    if selected_id.startswith("FOLDERLINK:"):
        folder_id = selected_id.removeprefix("FOLDERLINK:")
        service = get_drive_service(user["google_token"]["refresh_token"])
        if _drive_item_in_root(service, folder_id, user["root_folder_id"]):
            send_message(sender, f"https://drive.google.com/drive/u/0/folders/{folder_id}")


async def _handle_single_whatsapp_message(message: dict[str, Any], background_tasks: BackgroundTasks) -> None:
    try:
        sender = message["from"]
        message_type = message["type"]
        user = _profile_for_phone(sender)

        if message_type == "text":
            text_body = message.get("text", {}).get("body", "").strip()
            if text_body.upper() == "VERIFY":
                if not user:
                    send_message(sender, "Account not found. Please sign up on DocsFlow first.")
                    return Response("User not found", status_code=200)
                if not user.get("google_token"):
                    send_message(sender, "Connect Google Drive on the website first.")
                    return Response("Drive not linked", status_code=200)
                new_status = "ACTIVE" if user.get("root_folder_id") else "CONNECTED"
                supabase.table("profiles").update({
                    "status": new_status,
                    "whatsapp_verified": True,
                }).eq("id", user["id"]).execute()
                message_text = (
                    "Verified. Send me a file to organize."
                    if new_status == "ACTIVE"
                    else "Verified. Return to your dashboard to finish folder setup."
                )
                send_message(sender, message_text)
                return Response("Verified", status_code=200)

        status = user.get("status", "NEW") if user else "NEW"
        if status == "NEW":
            send_message(sender, f"Welcome to DocsFlow. Create your account here:\n{FRONTEND_URL}/signup")
        elif status in {"CONNECTED", "AWAITING_SYLLABUS", "EDITING_LIST"}:
            send_message(sender, f"Finish your DocsFlow setup here:\n{FRONTEND_URL}/setup")
        elif status == "ACTIVE" and user:
            if message_type == "text":
                await asyncio.to_thread(
                    _handle_text_search,
                    sender,
                    user,
                    message.get("text", {}).get("body", ""),
                )
            elif message_type == "interactive":
                await asyncio.to_thread(_handle_interaction, sender, user, message.get("interactive") or {})
            elif message_type in {"document", "image"}:
                media = message[message_type]
                media_id = media.get("id")
                filename = (
                    media.get("filename", f"document_{message['id']}.pdf")
                    if message_type == "document"
                    else f"image_{message['id']}.jpg"
                )
                if media_id:
                    try:
                        job_id = enqueue_ingestion_job(
                            user["id"],
                            sender,
                            message["id"],
                            media_id,
                            message_type,
                            filename,
                        )
                    except Exception as exc:
                        print(f"Could not enqueue ingestion: {exc}")
                        job_id = None
                    if job_id:
                        send_message(sender, "Received. I’m extracting, organizing, and indexing it now.")
                        background_tasks.add_task(process_ingestion_job, job_id)
            else:
                send_message(sender, "Send a PDF, Office document, image, or a search query.")
    except Exception as exc:
        print(f"WhatsApp message handling failed: {exc}")


@app.post("/webhook")
async def receive_whatsapp(request: Request, background_tasks: BackgroundTasks):
    raw_body = await request.body()
    if not verify_meta_signature(raw_body, request.headers.get("X-Hub-Signature-256")):
        return Response("Invalid signature", status_code=401)
    try:
        data = json.loads(raw_body)
    except json.JSONDecodeError:
        return Response("Invalid JSON", status_code=400)

    handled = 0
    for entry in data.get("entry") or []:
        for change in entry.get("changes") or []:
            value = change.get("value") or {}
            for message in value.get("messages") or []:
                await _handle_single_whatsapp_message(message, background_tasks)
                handled += 1
    return Response("OK" if handled else "Ignored", status_code=200)


@app.get("/webhook")
async def verify_webhook(request: Request):
    mode = request.query_params.get("hub.mode")
    token = request.query_params.get("hub.verify_token")
    challenge = request.query_params.get("hub.challenge")
    if mode == "subscribe" and token == VERIFY_TOKEN:
        return Response(content=challenge, status_code=200)
    return Response("Forbidden", status_code=403)
