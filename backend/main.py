import os
import io
import time
import requests
import json
from fastapi import FastAPI, Request, BackgroundTasks, Response
from dotenv import load_dotenv

# --- IMPORTS FROM OUR NEW MODULES ---


from test_sorting import analyze_document, upload_and_index
from folder_creator import build_drive_structure, append_folders_to_drive
from fastapi.responses import JSONResponse, RedirectResponse

from starlette.middleware.sessions import SessionMiddleware
from fastapi.responses import RedirectResponse
from fastapi.templating import Jinja2Templates
from fastapi import UploadFile, File
import shutil

from fastapi.middleware.cors import CORSMiddleware
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials

from fastapi import FastAPI, Request, Response, BackgroundTasks
from supabase import create_client, Client
from typing import List, Dict, Any
from supabase_client import supabase


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

# @app.post("/upload-syllabus")
# async def upload_syllabus_web(request: Request, file: UploadFile = File(...)):
#     phone = request.session.get("user_phone")
#     if not phone: return JSONResponse({"error": "Not logged in"}, status_code=401)
#
#     # 1. Save file locally
#     temp_filename = f"syllabus_{phone}.pdf"
#     with open(temp_filename, "wb") as buffer:
#         shutil.copyfileobj(file.file, buffer)
#
#     # 2. Parse (Assuming returns dict: {"Maths": [...], "Physics": [...]})
#     subjects_data = parse_syllabus_with_gemini(temp_filename)
#
#     # 3. Save to DB
#     update_user(phone, "temp_syllabus_list", subjects_data)
#     update_user(phone, "status", "EDITING_LIST")
#
#     # ✅ CORRECT: Send the full dictionary (Subjects + Units)
#     return JSONResponse(content={"subjects": subjects_data})



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
async def process_file_background(media_id, sender, filename):
    print(f"🔄 Processing file {filename} for {sender}...")

    # 1. Download from Meta
    file_bytes, mime_type = get_meta_media(media_id)
    if not file_bytes:
        send_message(sender, "❌ Failed to download file from WhatsApp servers.")
        return

    # 2. Fetch User & Folder Map
    user_res = supabase.table('profiles').select("*").eq("phone", sender).single().execute()
    user = user_res.data

    # 3. Analyze (Using the Gemini function we wrote earlier)
    # Ensure you have 'analyze_document' and 'upload_and_index' imported/defined!
    folder_map = user.get('folder_map', {})
    subject_list = list(folder_map.keys())

    analysis = analyze_document(file_bytes, mime_type, subject_list)

    # 4. Upload
    saved_subject = upload_and_index(
        user_id=user['id'],
        google_token=user['google_token']['refresh_token'],
        file_obj=file_bytes,
        mime_type=mime_type,
        filename=filename,
        analysis=analysis,
        folder_map=folder_map,
        root_id=user['root_folder_id']
    )

    send_message(sender, f"✅ Saved to *{saved_subject}* folder!\nTags: {', '.join(analysis['tags'])}")


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
        elif status == "ACTIVE":

            # 1. TEXT MESSAGE -> SEARCH
            if msg_type == 'text':
                text_body = msg.get('text', {}).get('body', '')

                # Check for "Search" intent in text
                if "find" in text_body.lower() or "search" in text_body.lower() or "get" in text_body.lower():
                    # (Assuming you have a search_drive_files helper)
                    # files = search_drive_files(sender, text_body)
                    # For now, just a placeholder:
                    send_message(sender, "🔍 Search feature coming next! Use Supabase search here.")
                else:
                    send_message(sender, "📤 Send me a file to save.")

            # 2. FILE MESSAGE -> SORTING
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