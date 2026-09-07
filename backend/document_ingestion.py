from __future__ import annotations

import io
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Callable

from googleapiclient.http import MediaIoBaseUpload

from document_pipeline import (
    MAX_FILE_BYTES,
    build_metadata,
    classify_document,
    describe_image,
    detect_mime_type,
    descriptive_filename,
    embed_texts,
    extract_document,
    has_readable_image_text,
    is_placeholder_filename,
    safe_filename,
    sha256_bytes,
    usable_caption,
)
from google_auth import get_drive_service
from supabase_client import supabase


@dataclass
class IngestionOutcome:
    file_id: str
    drive_file_id: str
    file_name: str
    folder_label: str
    title: str
    keywords: list[str]
    classification_status: str
    extraction_status: str
    alternatives: list[dict[str, Any]]
    duplicate: bool = False


def _existing_file(user_id: str, checksum: str) -> dict[str, Any] | None:
    response = (
        supabase.table("files")
        .select("id, drive_file_id, file_name, subject, unit, title, keywords, classification_status, classification_candidates, extraction_status")
        .eq("user_id", user_id)
        .eq("checksum", checksum)
        .limit(1)
        .execute()
    )
    return response.data[0] if response.data else None


def _delete_drive_file(refresh_token: str, drive_file_id: str) -> None:
    try:
        get_drive_service(refresh_token).files().delete(fileId=drive_file_id).execute()
    except Exception as exc:
        print(f"Could not compensate Drive upload {drive_file_id}: {exc}")


def _find_existing_drive_upload(drive_service, checksum: str, user_id: str) -> str | None:
    try:
        response = drive_service.files().list(
            q=(
                "appProperties has { key='docsflow_checksum' and value='" + checksum + "' } "
                "and appProperties has { key='docsflow_user_id' and value='" + user_id + "' } "
                "and trashed=false"
            ),
            pageSize=1,
            fields="files(id)",
        ).execute()
        files = response.get("files") or []
        return files[0]["id"] if files else None
    except Exception as exc:
        print(f"Could not reconcile prior Drive upload: {exc}")
        return None


def ingest_and_index_document(
    *,
    user: dict[str, Any],
    data: bytes,
    claimed_mime_type: str | None,
    original_filename: str,
    caption: str | None = None,
    ingestion_job_id: str | None = None,
    lease_guard: Callable[[], bool] | None = None,
) -> IngestionOutcome:
    if not data:
        raise ValueError("The uploaded file is empty")
    if len(data) > MAX_FILE_BYTES:
        raise ValueError(f"The uploaded file exceeds {MAX_FILE_BYTES // (1024 * 1024)} MB")

    user_id = user["id"]
    refresh_token = user["google_token"]["refresh_token"]
    folder_map = user.get("folder_map") or {}
    root_folder_id = user.get("root_folder_id")
    if not root_folder_id:
        raise ValueError("The user has no DocsFlow root folder")

    checksum = sha256_bytes(data)
    existing = _existing_file(user_id, checksum)
    if existing:
        folder_label = " / ".join(filter(None, [existing.get("subject"), existing.get("unit")]))
        return IngestionOutcome(
            file_id=existing["id"],
            drive_file_id=existing["drive_file_id"],
            file_name=existing["file_name"],
            folder_label=folder_label or "Imported Documents",
            title=existing.get("title") or existing["file_name"],
            keywords=existing.get("keywords") or [],
            classification_status=existing.get("classification_status") or "automatic",
            extraction_status=existing.get("extraction_status") or "complete",
            alternatives=existing.get("classification_candidates") or [],
            duplicate=True,
        )

    mime_type = detect_mime_type(data, claimed_mime_type, original_filename)
    file_name = safe_filename(original_filename, mime_type)
    extracted = extract_document(data, mime_type, file_name)

    # A fabricated name must not seed the title. build_metadata falls back to the
    # filename when a document has no usable heading, which previously turned
    # "image_wamid.HBgM...jpg" into the document's title.
    invented_name = is_placeholder_filename(original_filename)
    metadata = build_metadata(
        extracted,
        "" if invented_name else file_name,
        mime_type,
        image_data=data,
    )

    # Name the file, now that both the caption and the content have been read.
    #
    # The caption outranks everything, including a real filename the sender's phone
    # supplied. It is the one description typed deliberately about this document, at the
    # moment of sending, and it is the wording the sender will search for later. A photo
    # captioned "physics unit 3" beats the image model's "Photo of handwritten text", and
    # a scan captioned "physics unit 3" beats "Scan_20260101.pdf".
    caption_label = usable_caption(caption)
    if caption_label:
        file_name = descriptive_filename(caption_label, mime_type, fallback=file_name)
    elif invented_name:
        file_name = descriptive_filename(metadata.title, mime_type, fallback=file_name)

    # An image with no readable text but a recognised subject is still searchable, so it
    # is tracked separately from files nothing could be learned from.
    if extracted.extraction_status == "no_text" and metadata.keywords:
        extracted.extraction_status = "visual_only"

    classification = classify_document(
        extracted,
        metadata,
        file_name,
        folder_map,
        root_folder_id,
    )

    if extracted.extraction_status in {"complete", "visual_only"}:
        # The embedding model has a 512-token window, so a long body was silently
        # truncated and contributed nothing. Chunk vectors cover the body instead.
        document_embedding_input = "\n".join(filter(None, [
            # First, so the sender's own wording carries the most weight in the vector.
            caption_label,
            metadata.title,
            (metadata.document_type or "").replace("_", " "),
            " ".join(metadata.keywords[:20]),
            metadata.summary[:800],
        ]))
        embedding_inputs = [document_embedding_input, *[chunk.content for chunk in extracted.chunks]]
        embeddings = embed_texts(embedding_inputs)
        file_embedding = embeddings[0] if embeddings else None
        chunk_embeddings = embeddings[1:] if len(embeddings) > 1 else []
    else:
        file_embedding = None
        chunk_embeddings = []

    # Every image gets a CLIP vector, including screenshots that also carry text, so
    # visual queries can reach them. describe_image memoises, so this reuses the
    # inference already performed while building metadata.
    image_embedding = None
    if mime_type.startswith("image/"):
        description = describe_image(
            data,
            has_readable_text=has_readable_image_text(extracted.text),
        )
        if description:
            image_embedding = description.vector

    if lease_guard and not lease_guard():
        raise RuntimeError("Ingestion lease was lost before Drive upload")

    drive_service = get_drive_service(refresh_token)
    drive_file_id = None
    if ingestion_job_id:
        job_response = (
            supabase.table("ingestion_jobs")
            .select("drive_file_id")
            .eq("id", ingestion_job_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if job_response.data:
            drive_file_id = job_response.data[0].get("drive_file_id")
    drive_file_id = drive_file_id or _find_existing_drive_upload(drive_service, checksum, user_id)

    if not drive_file_id:
        media = MediaIoBaseUpload(io.BytesIO(data), mimetype=mime_type, resumable=True)
        drive_file = drive_service.files().create(
            body={
                "name": file_name,
                "parents": [classification.target_folder_id],
                "appProperties": {
                    "docsflow_checksum": checksum,
                    "docsflow_user_id": user_id,
                },
            },
            media_body=media,
            fields="id",
        ).execute()
        drive_file_id = drive_file["id"]

    if ingestion_job_id:
        supabase.table("ingestion_jobs").update({
            "drive_file_id": drive_file_id,
            "mime_type": mime_type,
        }).eq("id", ingestion_job_id).eq("user_id", user_id).execute()

    alternatives = [asdict(candidate) for candidate in classification.alternatives]
    tags = list(dict.fromkeys([
        classification.subject,
        *([classification.unit] if classification.unit else []),
        *metadata.keywords[:12],
    ]))
    payload = {
        "user_id": user_id,
        "file_name": file_name,
        "original_name": original_filename,
        "drive_file_id": drive_file_id,
        "folder_id": classification.target_folder_id,
        "subject": classification.subject,
        "unit": classification.unit,
        "tags": tags,
        "mime_type": mime_type,
        "size_bytes": len(data),
        "checksum": checksum,
        "document_type": metadata.document_type,
        "title": metadata.title,
        "summary": metadata.summary,
        "keywords": metadata.keywords,
        "entities": metadata.entities,
        "extraction_method": extracted.extraction_method,
        "extraction_status": extracted.extraction_status,
        "extraction_error": extracted.extraction_error,
        "classification_confidence": classification.confidence,
        "classification_status": classification.status,
        "classification_candidates": alternatives,
        "embedding": file_embedding,
        "image_embedding": image_embedding,
    }

    if lease_guard and not lease_guard():
        raise RuntimeError("Ingestion lease was lost before database indexing")

    try:
        inserted = supabase.table("files").insert(payload).execute().data
        if not inserted:
            raise RuntimeError("Supabase did not return the indexed file")
        file_id = inserted[0]["id"]

        if extracted.chunks:
            chunk_rows = []
            for index, chunk in enumerate(extracted.chunks):
                chunk_rows.append({
                    "file_id": file_id,
                    "user_id": user_id,
                    "chunk_index": chunk.index,
                    "page_number": chunk.page_number,
                    "content": chunk.content,
                    "embedding": chunk_embeddings[index] if index < len(chunk_embeddings) else None,
                })
            supabase.table("document_chunks").insert(chunk_rows).execute()
    except Exception:
        if "file_id" in locals():
            supabase.table("files").delete().eq("id", file_id).eq("user_id", user_id).execute()
        if not ingestion_job_id:
            _delete_drive_file(refresh_token, drive_file_id)
        raise

    if ingestion_job_id:
        supabase.table("ingestion_jobs").update({"file_id": file_id}).eq("id", ingestion_job_id).eq("user_id", user_id).execute()

    return IngestionOutcome(
        file_id=file_id,
        drive_file_id=drive_file_id,
        file_name=file_name,
        folder_label=classification.target_label,
        title=metadata.title,
        keywords=metadata.keywords,
        classification_status=classification.status,
        extraction_status=extracted.extraction_status,
        alternatives=alternatives,
    )


def _valid_folder_ids(user: dict[str, Any]) -> set[str]:
    valid = {str(user.get("root_folder_id"))}
    for data in (user.get("folder_map") or {}).values():
        if not isinstance(data, dict):
            continue
        if data.get("id"):
            valid.add(str(data["id"]))
        valid.update(str(value) for value in (data.get("units") or {}).values() if value)
    return valid


def apply_classification_choice(user: dict[str, Any], file_id: str, candidate_index: int, query: str = "") -> str:
    response = (
        supabase.table("files")
        .select("id, drive_file_id, folder_id, classification_candidates")
        .eq("id", file_id)
        .eq("user_id", user["id"])
        .limit(1)
        .execute()
    )
    if not response.data:
        raise ValueError("File not found")

    file_row = response.data[0]
    candidates = file_row.get("classification_candidates") or []
    if candidate_index < 0 or candidate_index >= len(candidates):
        raise ValueError("Classification choice is no longer available")
    candidate = candidates[candidate_index]
    target_folder_id = str(candidate.get("folder_id") or "")
    if target_folder_id not in _valid_folder_ids(user):
        raise ValueError("The selected folder does not belong to this account")

    refresh_token = user["google_token"]["refresh_token"]
    drive_service = get_drive_service(refresh_token)
    update_kwargs = {
        "fileId": file_row["drive_file_id"],
        "addParents": target_folder_id,
        "fields": "id, parents",
    }
    old_folder_id = file_row.get("folder_id")
    if old_folder_id and old_folder_id != target_folder_id:
        update_kwargs["removeParents"] = old_folder_id
    moved = False
    try:
        drive_service.files().update(**update_kwargs).execute()
        moved = True
        supabase.table("files").update({
            "folder_id": target_folder_id,
            "subject": candidate.get("subject"),
            "unit": candidate.get("unit"),
            "classification_confidence": candidate.get("score"),
            "classification_status": "user_confirmed",
        }).eq("id", file_id).eq("user_id", user["id"]).execute()
    except Exception:
        if moved and old_folder_id and old_folder_id != target_folder_id:
            try:
                drive_service.files().update(
                    fileId=file_row["drive_file_id"],
                    addParents=old_folder_id,
                    removeParents=target_folder_id,
                    fields="id, parents",
                ).execute()
            except Exception as compensation_error:
                print(f"Could not compensate classification move: {compensation_error}")
        raise

    try:
        supabase.table("search_feedback").insert({
            "user_id": user["id"],
            "query": query or "classification correction",
            "shown_file_ids": [file_id],
            "selected_file_id": file_id,
            "feedback_type": "classification_corrected",
            "metadata": {"folder_id": target_folder_id, "candidate_index": candidate_index},
        }).execute()
    except Exception as exc:
        print(f"Could not record classification feedback: {exc}")
    return candidate.get("label") or candidate.get("subject") or "selected folder"


def rename_document(user: dict[str, Any], file_id: str, requested_name: str) -> str:
    """Rename a saved file in Drive and in the index, returning the name that stuck.

    The extension always comes from the stored name rather than from what was typed. The
    sender is naming the document, not choosing its format, so "Physics unit 3" must not
    leave a Drive file with no extension: trigger_file_send re-uploads to WhatsApp using
    this name, and WhatsApp needs the extension to send it back as the right kind of
    attachment.
    """
    response = (
        supabase.table("files")
        .select("id, drive_file_id, file_name, mime_type")
        .eq("id", file_id)
        .eq("user_id", user["id"])
        .limit(1)
        .execute()
    )
    if not response.data:
        raise ValueError("File not found")

    file_row = response.data[0]
    mime_type = file_row.get("mime_type") or ""
    # usable_caption also strips "save this as ..." lead-ins, which people type when
    # replying with a new name just as often as when captioning a photo.
    cleaned = safe_filename(usable_caption(requested_name) or requested_name, mime_type)
    stem = Path(cleaned).stem.strip()
    if not stem:
        raise ValueError("That name is empty")

    previous_name = file_row.get("file_name") or ""
    extension = Path(previous_name).suffix or Path(cleaned).suffix
    new_name = f"{stem}{extension}"
    if new_name == previous_name:
        return previous_name

    drive_service = get_drive_service(user["google_token"]["refresh_token"])
    drive_service.files().update(
        fileId=file_row["drive_file_id"],
        body={"name": new_name},
        fields="id, name",
    ).execute()

    try:
        supabase.table("files").update({"file_name": new_name}).eq("id", file_id).eq(
            "user_id", user["id"]
        ).execute()
    except Exception:
        # Drive has already accepted the new name. Put the old one back so the two stores
        # cannot disagree about what this file is called: search reads the index, and the
        # sender reads Drive.
        try:
            drive_service.files().update(
                fileId=file_row["drive_file_id"],
                body={"name": previous_name},
                fields="id",
            ).execute()
        except Exception as compensation_error:
            print(f"Could not restore the previous filename: {compensation_error}")
        raise

    return new_name
