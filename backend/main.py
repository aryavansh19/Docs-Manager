import os
import io
import time
import json
import requests
from dotenv import load_dotenv
from fastapi import UploadFile, File
# --- IMPORTS FROM OUR NEW MODULES ---

import mimetypes
from test_sorting import analyze_document, upload_and_index
from folder_creator import build_drive_structure, append_folders_to_drive
from fastapi.responses import JSONResponse, RedirectResponse
from drive_search import search_files_in_db, get_drive_link, find_folder_match
from Interative_List import send_interactive_list

from starlette.middleware.sessions import SessionMiddleware
from fastapi.middleware.cors import CORSMiddleware
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from googleapiclient.http import MediaIoBaseDownload
from fastapi import FastAPI, Request, Response, BackgroundTasks
from typing import List, Dict, Any
from supabase_client import supabase
import google.generativeai as genai

load_dotenv()

app = FastAPI()

# 1. KEEP THIS: Required for Google OAuth (to remember user during redirects)
app.add_middleware(SessionMiddleware, secret_key="super-secret-random-string",max_age=3600,
    same_site="None",   # 👈 Critical: Allows cross-site cookies
    https_only=True)

# 2. ADD THIS: Allow React (Port 5173) to talk to Python (Port 8000)
origins = [
    "http://localhost:5173",  # Vite (React) default port
    "http://localhost:3000",  # Just in case
]

# In main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,    # This MUST be True for cookies to work
    allow_methods=["*"],
    allow_headers=["*"],
)
# --- CONFIG ---
META_TOKEN = os.getenv("META_TOKEN")
PHONE_NUMBER_ID = os.getenv("PHONE_NUMBER_ID")
VERIFY_TOKEN = os.getenv("VERIFY_TOKEN")
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")

if not META_TOKEN or not PHONE_NUMBER_ID:
    raise ValueError("❌ Missing Keys! Check your .env file.")

# --- MEMORY FOR BUTTONS ---
pending_actions = {}

from pydantic import BaseModel


# 1. Define the Data Model (What React sends to Python)
class SetupRequest(BaseModel):
    phone: str
    subjects: list[str]  # e.g., ["Physics", "Chemistry", "Maths"]

# --- HELPER: Send Text ---
def send_message(to, text):
    url = f"https://graph.facebook.com/v17.0/{PHONE_NUMBER_ID}/messages"
    headers = {
        "Authorization": f"Bearer {META_TOKEN}",
        "Content-Type": "application/json"
    }
    requests.post(url, headers=headers, json={
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {"body": text}
    })


# --- HELPER: Send Buttons ---
def send_buttons(to, text, buttons):
    """
    buttons = [{"id": "yes", "title": "Save"}, {"id": "no", "title": "Discard"}]
    """
    url = f"https://graph.facebook.com/v17.0/{PHONE_NUMBER_ID}/messages"
    headers = {
        "Authorization": f"Bearer {META_TOKEN}",
        "Content-Type": "application/json"
    }
    button_actions = [{"type": "reply", "reply": {"id": b["id"], "title": b["title"]}} for b in buttons]

    data = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "interactive",
        "interactive": {
            "type": "button",
            "body": {"text": text},
            "action": {"buttons": button_actions}
        }
    }
    requests.post(url, headers=headers, json=data)


# --- HELPER: TRIGGER FILE SEND (ROBUST) ---
def trigger_file_send(to_number, drive_file_id, filename):
    print(f"🚀 Triggering send for: {filename}")

    # 1. Get User Token
    user_res = supabase.table('profiles').select("google_token").eq("phone", to_number).single().execute()
    if not user_res.data: return
    token = user_res.data['google_token']['refresh_token']

    # 2. Download from Drive
    file_bytes = download_drive_file(token, drive_file_id)

    if file_bytes:
        # ---------------------------------------------------------
        # 🟢 FIX: DETECT REAL FILE TYPE (MAGIC BYTES)
        # ---------------------------------------------------------
        # Read the first 4 bytes to see what the file actually is
        header = file_bytes.read(4)
        file_bytes.seek(0)  # IMPORTANT: Reset pointer after reading!

        mime_type = "application/pdf"  # Default

        # Check signatures
        if header.startswith(b'\xff\xd8'):
            mime_type = "image/jpeg"
        elif header.startswith(b'\x89PNG'):
            mime_type = "image/png"
        elif header.startswith(b'%PDF'):
            mime_type = "application/pdf"
        elif header.startswith(b'PK'):
            mime_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"  # Docx/Zip

        print(f"🔍 Real detected type: {mime_type}")

        # ---------------------------------------------------------
        # 🟢 FIX: CHOOSE MESSAGE TYPE
        # ---------------------------------------------------------
        if mime_type.startswith("image/"):
            msg_type = "image"
        else:
            msg_type = "document"

        # 3. Upload to WhatsApp
        media_id = upload_to_whatsapp(file_bytes, mime_type, filename)

        if media_id:
            # 4. Send Message
            url = f"https://graph.facebook.com/v17.0/{PHONE_NUMBER_ID}/messages"
            headers = {"Authorization": f"Bearer {META_TOKEN}", "Content-Type": "application/json"}

            data = {
                "messaging_product": "whatsapp",
                "to": to_number,
                "type": msg_type,
                msg_type: {
                    "id": media_id,
                    "caption": f"📄 {filename}" if msg_type == "document" else None
                }
            }

            # For documents, force the filename to be correct
            if msg_type == "document":
                data["document"]["filename"] = filename

            r = requests.post(url, headers=headers, json=data)
            print(f"✅ Sent status: {r.status_code}")
        else:
            send_message(to_number, "⚠️ Error uploading file to WhatsApp.")
    else:
        send_message(to_number, "⚠️ Could not download file from Drive.")


# --- HELPER: LIST FOLDER CONTENTS FROM DRIVE ---
def list_drive_folder(google_token, folder_id):
    try:
        service = get_drive_service(google_token)
        # Query: Inside this folder, not trashed
        query = f"'{folder_id}' in parents and trashed=false"

        results = service.files().list(
            q=query,
            pageSize=10,  # WhatsApp Limit
            fields="files(id, name, mimeType)"
        ).execute()

        return results.get('files', [])
    except Exception as e:
        print(f"❌ Drive List Error: {e}")
        return []


@app.get("/")
async def health_check():
    return {"status": "online", "message": "Python Backend is runnning!"}


# --- HELPER: Get Drive Service (Put this near other helpers) ---
def get_drive_service(refresh_token):
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
    creds = Credentials(
        None, refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=client_id, client_secret=client_secret
    )
    return build('drive', 'v3', credentials=creds)


# --- API: BROWSE DRIVE FOLDER ---
@app.get("/api/drive/browse")
async def browse_drive(request: Request, folder_id: str):
    try:
        # 1. AUTHENTICATION
        auth_header = request.headers.get('Authorization')
        if not auth_header: return Response("Missing Token", 401)
        token = auth_header.replace("Bearer ", "")
        user_res = supabase.auth.get_user(token)
        if not user_res.user: return Response("Invalid Token", 401)
        user_id = user_res.user.id

        # 2. GET CREDENTIALS
        profile = supabase.table('profiles').select("google_token, root_folder_id").eq('id', user_id).single().execute()
        google_data = profile.data.get('google_token')
        if not google_data: return Response("Google Drive not linked", 400)

        service = get_drive_service(google_data['refresh_token'])

        # ---------------------------------------------------------
        # 3. VERIFY EXISTENCE (The Fix)
        # ---------------------------------------------------------
        try:
            # We try to get the folder's metadata.
            # If it's deleted/trashed, this throws an error.
            folder_meta = service.files().get(
                fileId=folder_id,
                fields="id, name, trashed"
            ).execute()

            if folder_meta.get('trashed') is True:
                raise Exception("Folder is in Trash")

        except Exception as e:
            print(f"⚠️ Folder {folder_id} not found or trashed.")

            # OPTIONAL: If the ROOT folder is gone, we can reset the user's status!
            saved_root = profile.data.get('root_folder_id')
            if saved_root == folder_id:
                print("🚨 Root folder deleted! Resetting user status...")
                supabase.table('profiles').update({
                    "status": "CONNECTED",  # Send them back to Setup
                    "root_folder_id": None,
                    "folder_map": None
                }).eq('id', user_id).execute()

                return JSONResponse({
                    "error": "ROOT_DELETED",
                    "message": "Your main folder was deleted. Please run setup again."
                }, status_code=404)

            return JSONResponse({
                "error": "FOLDER_DELETED",
                "message": "This folder no longer exists on Drive."
            }, status_code=404)

        # ---------------------------------------------------------
        # 4. FETCH FILES (Only if it exists)
        # ---------------------------------------------------------
        query = f"'{folder_id}' in parents and trashed=false"
        results = service.files().list(
            q=query,
            pageSize=100,
            fields="files(id, name, mimeType, iconLink, webViewLink, thumbnailLink)"
        ).execute()

        items = results.get('files', [])

        folders = []
        files = []

        for item in items:
            clean_item = {
                "id": item['id'],
                "name": item['name'],
                "mimeType": item['mimeType'],
                "link": item['webViewLink']
            }
            if item['mimeType'] == 'application/vnd.google-apps.folder':
                folders.append(clean_item)
            else:
                files.append(clean_item)

        return {"folders": folders, "files": files}
    except Exception as e:
        print(f"❌ Browse Error: {str(e)}")
        return Response(f"Error: {str(e)}", 500)



# 1. Define the Data Model (Matches what Setup.jsx sends)
class SubjectItem(BaseModel):
    name: str
    units: List[str] = []


class CreateFoldersRequest(BaseModel):
    subjects: List[SubjectItem]


# --- BACKGROUND WORKER (Add to main.py) ---
async def run_folder_creation_worker(user_id: str, phone: str, refresh_token: str, structure: dict, root_id: str = None,
                                     existing_map: dict = None):
    print(f"👷‍♂️ WORKER: Starting folder creation for {phone}...")

    try:
        new_map = {}
        final_root_id = root_id

        # --- MODE 1: APPEND (If Root Exists) ---
        if root_id:
            items_to_add = {}
            for subj, units in structure.items():
                if subj not in (existing_map or {}):
                    items_to_add[subj] = units

            if items_to_add:
                # Assuming append_folders_to_drive is imported
                new_map = append_folders_to_drive(refresh_token, root_id, items_to_add)
                if existing_map:
                    existing_map.update(new_map)
                    new_map = existing_map

                    # --- MODE 2: FRESH SETUP (No Root) ---
        else:
            # Assuming build_drive_structure is imported
            final_root_id, new_map = build_drive_structure(refresh_token, structure, folder_name_suffix=phone)

        # SAVE TO SUPABASE
        print(f"💾 WORKER: Saving data to Supabase...")
        supabase.table('profiles').update({
            "folder_map": new_map,
            "root_folder_id": final_root_id,
            "status": "ACTIVE"
        }).eq('id', user_id).execute()

        send_message(phone, "✅ *All set!* Your folders are ready.")
        print(f"✅ WORKER: Finished successfully for {phone}")

    except Exception as e:
        print(f"❌ WORKER FAILED: {str(e)}")


@app.post("/create-folders")
async def create_folders_web(request: Request, background_tasks: BackgroundTasks):
    print("🔔 API: Connection received! Parsing data...")  # <--- THIS WILL PRINT NOW

    try:
        # 1. READ BODY MANUALLY (Prevents validation hangs)
        body = await request.json()
        print(f"📦 API: Received Data: {body}")

        # Extract subjects safely
        subjects_list = body.get('subjects', [])
        structure = {item['name']: item.get('units', []) for item in subjects_list}

        # 2. AUTHENTICATION
        auth_header = request.headers.get('Authorization')
        if not auth_header: return Response("Missing Token", 401)

        token = auth_header.replace("Bearer ", "")
        user_res = supabase.auth.get_user(token)
        if not user_res.user: return Response("Invalid Token", 401)

        user_id = user_res.user.id

        # 3. GET USER DETAILS
        profile = supabase.table('profiles').select("*").eq('id', user_id).single().execute()
        user = profile.data

        google_data = user.get('google_token')
        if not google_data or 'refresh_token' not in google_data:
            print("❌ API Error: Google Drive not linked")
            return Response("Google Drive not linked", 400)

        refresh_token = google_data['refresh_token']

        # 4. INJECT DEFAULTS (For new users)
        if not user.get('root_folder_id'):
            defaults = {
                "Important Documents": ["Aadhar Card", "PAN Card"],
                "Screenshots": [],
                "Identity Cards": [],
                "Personal": [],
                "Imported Documents": []
            }
            for k, v in defaults.items():
                if k not in structure: structure[k] = v

        # 5. START BACKGROUND WORKER
        background_tasks.add_task(
            run_folder_creation_worker,
            user_id=user_id,
            phone=user.get('phone'),
            refresh_token=refresh_token,
            structure=structure,
            root_id=user.get('root_folder_id'),
            existing_map=user.get('folder_map')
        )

        print("🚀 API: Background task started. Replying to Frontend.")
        return {"status": "processing", "message": "Creation started"}

    except Exception as e:
        print(f"❌ API CRASH: {str(e)}")
        import traceback
        traceback.print_exc()
        return Response(f"Internal Error: {str(e)}", 500)


# --- HELPER: PARSE SYLLABUS WITH GEMINI ---
def parse_syllabus_with_gemini(file_bytes, mime_type):
    model = genai.GenerativeModel('gemini-2.5-flash')

    prompt = """
    You are an academic assistant. Analyze this syllabus document.
    1. Identify the 'Subjects' or 'Courses'.
    2. For each subject, list the 'Units' or 'Chapters' or 'Modules'.

    Return STRICT JSON format like this:
    {
      "Engineering Mathematics": ["Matrices", "Calculus", "Differential Equations"],
      "Physics": ["Quantum Mechanics", "Optics", "Lasers"],
      "Programming": ["C++ Basics", "OOPs", "Data Structures"]
    }

    If the document is unclear, do your best to structure it. Return ONLY JSON.
    """

    try:
        response = model.generate_content([
            {"mime_type": mime_type, "data": file_bytes},
            prompt
        ])

        # Clean the response (remove ```json marks)
        text = response.text.replace("```json", "").replace("```", "").strip()
        return json.loads(text)
    except Exception as e:
        print(f"❌ Gemini Parse Error: {e}")
        return {}  # Return empty dict on failure



@app.post("/api/upload-syllabus")
async def upload_syllabus(request: Request, file: UploadFile = File(...)):
    try:
        # 1. AUTHENTICATION (Get User ID from Token)
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return JSONResponse({"error": "Missing Token"}, status_code=401)

        token = auth_header.replace("Bearer ", "")
        user_res = supabase.auth.get_user(token)

        if not user_res.user:
            return JSONResponse({"error": "Invalid Token"}, status_code=401)

        user_id = user_res.user.id

        # 2. READ FILE BYTES
        # We read it into memory directly (no need to save to disk temporarily)
        file_content = await file.read()
        mime_type = file.content_type

        # 3. PARSE WITH GEMINI
        print("🧠 Sending syllabus to Gemini...")
        subjects_data = parse_syllabus_with_gemini(file_content, mime_type)

        if not subjects_data:
            return JSONResponse({"error": "Could not parse syllabus"}, status_code=400)

        # 4. SAVE DRAFT TO SUPABASE
        # We save this to 'folder_map' so the frontend can load it for editing
        # We also set status to 'EDITING_LIST'
        supabase.table('profiles').update({
            "folder_map": subjects_data,
            "status": "EDITING_LIST"
        }).eq('id', user_id).execute()

        print(f"✅ Parsed {len(subjects_data)} subjects for user {user_id}")

        # 5. RETURN TO FRONTEND
        return {
            "success": True,
            "subjects": subjects_data
        }

    except Exception as e:
        print(f"❌ Upload Error: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)



# --- HELPER: DOWNLOAD MEDIA FROM META ---
def get_meta_media(media_id):
    # 1. Get the URL
    url_info = f"https://graph.facebook.com/v17.0/{media_id}"
    headers = {"Authorization": f"Bearer {META_TOKEN}"}

    resp_info = requests.get(url_info, headers=headers).json()
    media_url = resp_info.get('url')
    mime_type = resp_info.get('mime_type')

    if not media_url: return None, None

    # 2. Download binary data
    resp_data = requests.get(media_url, headers=headers)
    return io.BytesIO(resp_data.content), mime_type


# --- BACKGROUND TASK: PROCESS FILE ---
async def process_file_background(media_id, sender, original_filename):
    print(f"🔄 Processing file {original_filename} for {sender}...")

    # 1. Download from Meta (WhatsApp)
    file_bytes, mime_type = get_meta_media(media_id)
    if not file_bytes:
        send_message(sender, "❌ Failed to download file from WhatsApp servers.")
        return

    # 2. Fetch User & Folder Map
    # We need to know who the user is to get their folders
    user_res = supabase.table('profiles').select("*").eq("phone", sender).single().execute()
    user = user_res.data

    if not user:
        print(f"⚠️ User {sender} not found during background processing.")
        return

    # 3. Analyze (Ask Gemini for Subject + Filename)
    folder_map = user.get('folder_map', {})

    analysis = analyze_document(file_bytes, mime_type, folder_map)

    # 4. Upload & Index (Save to Drive & DB)
    # Notice we pass 'original_filename' so we preserve the extension (.pdf/.jpg)
    saved_subject = upload_and_index(
        user_id=user['id'],
        google_token=user['google_token']['refresh_token'],
        file_obj=file_bytes,
        mime_type=mime_type,
        original_filename=original_filename,
        analysis=analysis,
        folder_map=folder_map,
        root_id=user['root_folder_id']
    )

    # 5. Notify User
    # We show them the new name Gemini chose!
    new_name = analysis.get('filename', original_filename)
    tags_str = ", ".join(analysis.get('tags', []))

    send_message(sender, f"✅ Saved as *{new_name}* in *{saved_subject}* folder!\n🏷️ Tags: {tags_str}")



# --- HELPER: DOWNLOAD FROM DRIVE ---
def download_drive_file(google_token, file_id):
    try:
        service = get_drive_service(google_token)
        # request to get the file content
        request = service.files().get_media(fileId=file_id)

        file_data = io.BytesIO()
        downloader = MediaIoBaseDownload(file_data, request)

        done = False
        while done is False:
            status, done = downloader.next_chunk()

        file_data.seek(0)  # Reset pointer to start
        return file_data
    except Exception as e:
        print(f"❌ Drive Download Error: {e}")
        return None


# --- HELPER: UPLOAD TO WHATSAPP (Get Media ID) ---
def upload_to_whatsapp(file_bytes, mime_type, filename):
    url = f"https://graph.facebook.com/v17.0/{PHONE_NUMBER_ID}/media"
    headers = {
        "Authorization": f"Bearer {META_TOKEN}"
    }

    # Files structure for requests
    files = {
        'file': (filename, file_bytes, mime_type)
    }
    data = {
        'messaging_product': 'whatsapp'
    }

    try:
        r = requests.post(url, headers=headers, files=files, data=data)
        return r.json().get('id')
    except Exception as e:
        print(f"❌ Meta Upload Error: {e}")
        return None


@app.post("/webhook")
async def receive_whatsapp(request: Request, background_tasks: BackgroundTasks):
    try:
        data = await request.json()

        # ---------------------------------------------------------
        # 🛡️ 1. SAFETY CHECKS
        # ---------------------------------------------------------
        entry = data.get('entry', [])
        if not entry or not entry[0].get('changes'):
            return Response(content="No Data", status_code=200)

        value = entry[0]['changes'][0].get('value')

        # Ignore status updates (read receipts)
        if not value or 'messages' not in value:
            return Response(content="Ignored", status_code=200)

        # ---------------------------------------------------------
        # 📩 2. EXTRACT MESSAGE INFO
        # ---------------------------------------------------------
        msg = value['messages'][0]
        sender = msg['from']  # Meta sends '919876543210' (no +)
        msg_type = msg['type']

        # ---------------------------------------------------------
        # 🔍 3. SUPABASE LOOKUP
        # ---------------------------------------------------------
        user = {}
        status = "NEW"

        try:
            # We assume your DB stores phones like '919876543210' or '+91...'
            # Meta sends clean numbers usually. You might need to add/remove '+' depending on your DB.
            response = supabase.table('profiles').select("*").eq("phone", sender).execute()
            if response.data:
                user = response.data[0]
                status = user.get('status', 'NEW')
        except Exception as e:
            print(f"⚠️ DB Error: {e}")

        # ============================================================
        # 🚀 4. VERIFICATION INTERCEPTOR (Your Logic)
        # ============================================================
        if msg_type == 'text':
            text_body = msg.get('text', {}).get('body', '').strip().upper()

            if text_body == "VERIFY":
                if not user:
                    send_message(sender, "⚠️ *Account Not Found*\nPlease sign up at docflow.ai first.")
                    return Response(content="User Not Found", status_code=200)

                if not user.get("google_token"):
                    send_message(sender, "⚠️ *Google Login Missing*\nPlease login on the website first.")
                    return Response(content="No Token", status_code=200)

                # Determine new status
                new_status = "ACTIVE" if user.get("root_folder_id") else "CONNECTED"

                # Update DB
                supabase.table('profiles').update({"status": new_status}).eq("phone", sender).execute()

                if new_status == "ACTIVE":
                    send_message(sender, "✅ *Verified!* Send me a file to organize.")
                else:
                    send_message(sender, "✅ *Linked!* Check your dashboard to finish setup.")

                return Response(content="Verified", status_code=200)

        # ============================================================
        # 🚦 5. STATUS HANDLER
        # ============================================================
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")  # Update for Prod

        # --- CASE A: NEW USER ---
        if status == "NEW":
            send_message(sender, f"👋 *Welcome!* \nTap below to setup:\n{frontend_url}/signup")

        # --- CASE B: PENDING SETUP ---
        elif status in ["CONNECTED", "AWAITING_SYLLABUS", "EDITING_LIST"]:
            send_message(sender, f"⏳ *Almost done!* \nFinish setup here:\n{frontend_url}/setup")

        # --- CASE C: ACTIVE USER ---
        # ... inside CASE C: ACTIVE USER ...
        elif status == "ACTIVE":

            # ---------------------------------------------------------
            # 1. HANDLE TEXT (SEARCH INTENT)
            # ---------------------------------------------------------
            if msg_type == 'text':

                text_body = msg.get('text', {}).get('body', '')

                # 1. AGGRESSIVE CLEANING
                # Remove all these common "bot words" so we are left with just the Topic
                stop_words = ["find", "search", "show", "give", "get", "notes", "for", "me", "my", "the", "files",
                              "document"]

                clean_query = text_body.lower()
                for word in stop_words:
                    clean_query = clean_query.replace(word, "")

                clean_query = clean_query.strip()

                # ... (Rest of logic remains the same) ...
                folder_match = find_folder_match(user, clean_query)

                if folder_match:
                    # == CASE A: IT IS A SUBJECT (e.g. "Full Stack") ==
                    if folder_match['type'] == 'SUBJECT':
                        subject_name = folder_match['name']
                        units = folder_match['children']

                        menu_items = []
                        # List all Units in this Subject
                        for unit_name, unit_id in units.items():
                            menu_items.append({
                                "id": f"BROWSE:{unit_id}",
                                "title": unit_name[:24],
                                "description": "Unit Folder"
                            })

                        # Always add a "View All Files" option
                        menu_items.append({
                            "id": f"BROWSE:{folder_match['id']}",
                            "title": "📂 All Files",
                            "description": f"Everything in {subject_name}"
                        })

                        send_interactive_list(
                            to_number=sender,
                            body_text=f"📂 *{subject_name}*\nSelect a Unit to browse:",
                            button_text="Open Unit",
                            items=menu_items
                        )
                        return Response(content="OK", status_code=200)

                    # == CASE B: IT IS A UNIT (e.g. "React JS") ==
                    elif folder_match['type'] == 'UNIT':
                        unit_name = folder_match['name']
                        unit_id = folder_match['id']

                        # 1. Check if files exist in this Unit (Database Query)
                        # We do NOT rely on keywords. We strictly check "folder_id".
                        files_in_unit = supabase.table('files') \
                            .select("*") \
                            .eq("user_id", user['id']) \
                            .eq("folder_id", unit_id) \
                            .execute().data

                        if not files_in_unit:
                            # ✅ THE "EMPTY FOLDER" HANDLING
                            link = f"https://drive.google.com/drive/u/0/folders/{unit_id}"
                            send_message(sender, f"ZE *{unit_name}* is empty.\n\nupload files here:\n{link}")
                        else:
                            # Show the file menu
                            menu_items = []
                            for f in files_in_unit[:9]:
                                menu_items.append({
                                    "id": f"FILE:{f['drive_file_id']}",
                                    "title": f['file_name'][:24],
                                    "description": "Tap to download"
                                })

                            # Add Link option
                            menu_items.append({
                                "id": f"CMD:FOLDER_LINK",
                                # You might need to pass specific folder ID here if you want deep linking
                                "title": "🔗 Drive Link",
                                "description": "View in Google Drive"
                            })

                            send_interactive_list(
                                to_number=sender,
                                body_text=f"📂 *{unit_name}* ({len(files_in_unit)} files):",
                                button_text="Select File",
                                items=menu_items
                            )
                        return Response(content="OK", status_code=200)

                # ---------------------------------------------------------
                # 🔵 STRATEGY 2: GLOBAL FILE SEARCH (Fallback)
                # ---------------------------------------------------------
                # Only runs if user query didn't match any Subject or Unit name
                results = search_files_in_db(user['id'], clean_query)

                if not results:
                    send_message(sender, f"❌ No folders or files found for '{clean_query}'.")

                elif len(results) == 1:
                    # If it's a specific file match, send it directly
                    f = results[0]
                    trigger_file_send(sender, f['drive_file_id'], f['file_name'])

                else:
                    # Show mixed file results
                    menu_items = []
                    for f in results[:10]:
                        menu_items.append({
                            "id": f"FILE:{f['drive_file_id']}",
                            "title": f['file_name'][:24],
                            "description": f.get('subject', 'File')
                        })

                    send_interactive_list(
                        to_number=sender,
                        body_text=f"🔍 Found {len(results)} files for '{clean_query}':",
                        button_text="View Results",
                        items=menu_items
                    )

            # ---------------------------------------------------------
            # 2. HANDLE INTERACTIVE (MENU CLICKS) 🟢 (NEW)
            # ---------------------------------------------------------
                    # ... inside 'elif msg_type == interactive' ...
            elif msg_type == 'interactive':
                    interaction = msg['interactive']

                    if interaction['type'] == 'list_reply':
                        selected_id = interaction['list_reply']['id']
                        selected_title = interaction['list_reply']['title']

                        # ====================================================
                        # 🟢 CASE 1: USER WANTS TO OPEN A FOLDER (Drill Down)
                        # ====================================================
                        if selected_id.startswith("BROWSE:"):
                            folder_id = selected_id.replace("BROWSE:", "")

                            send_message(sender, f"📂 Opening *{selected_title}*...")

                            # 1. Fetch children from Drive
                            token = user['google_token']['refresh_token']
                            items = list_drive_folder(token, folder_id)

                            if not items:
                                send_message(sender, "⚠️ This folder is empty.")
                            else:
                                # 2. Build New Menu
                                menu_items = []
                                for item in items:
                                    is_folder = "folder" in item['mimeType']

                                    # If it's a folder, the ID triggers 'BROWSE' again (Recursion!)
                                    # If it's a file, the ID triggers 'FILE' (Download)
                                    action_prefix = "BROWSE:" if is_folder else "FILE:"
                                    icon = "📂" if is_folder else "📄"

                                    menu_items.append({
                                        "id": f"{action_prefix}{item['id']}",
                                        "title": item['name'],
                                        "description": "Folder" if is_folder else "File"
                                    })

                                # 3. Send the New List
                                send_interactive_list(
                                    to_number=sender,
                                    body_text=f"📂 Contents of *{selected_title}*:",
                                    button_text="Open",
                                    items=menu_items
                                )

                        # ====================================================
                        # 🟢 CASE 2: USER SELECTED A FILE (Download)
                        # ====================================================
                        elif selected_id.startswith("FILE:"):
                            drive_file_id = selected_id.replace("FILE:", "")
                            send_message(sender, f"⬇️ Fetching *{selected_title}*...")
                            trigger_file_send(sender, drive_file_id, selected_title)

                        # ====================================================
                        # 🟢 CASE 3: OPEN LINK (Fallback)
                        # ====================================================
                        elif selected_id == "CMD:FOLDER_LINK":
                            root_id = user.get('root_folder_id')
                            link = f"https://drive.google.com/drive/u/0/folders/{root_id}"
                            send_message(sender, f"🔗 *Drive Link:*\n{link}")


            # ---------------------------------------------------------
            # 3. HANDLE FILE UPLOAD (Your existing logic)
            # ---------------------------------------------------------
            elif msg_type in ['document', 'image']:
                media_id = None
                filename = f"upload_{sender}"

                if msg_type == 'document':
                    media_id = msg['document']['id']
                    filename = msg['document'].get('filename', f"doc_{sender}.pdf")
                elif msg_type == 'image':
                    media_id = msg['image']['id']
                    filename = f"img_{sender}.jpg"

                if media_id:
                    send_message(sender, "🤖 Analyzing document...")
                    background_tasks.add_task(process_file_background, media_id, sender, filename)

    except Exception as e:
        print(f"❌ Webhook Error: {e}")
        import traceback
        traceback.print_exc()

    return Response(content="OK", status_code=200)





# --- VERIFY WEBHOOK ---
@app.get("/webhook")
async def verify_webhook(request: Request):
    # This verifies your URL with Meta
    mode = request.query_params.get("hub.mode")
    token = request.query_params.get("hub.verify_token")
    challenge = request.query_params.get("hub.challenge")

    if mode == "subscribe" and token == VERIFY_TOKEN:
        return Response(content=challenge, status_code=200)

    return Response(content="Forbidden", status_code=403)