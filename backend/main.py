import os
import time
import requests
import json
from fastapi import FastAPI, Request, BackgroundTasks, Response
from dotenv import load_dotenv

# --- IMPORTS FROM OUR NEW MODULES ---
from database import get_user, update_user, get_user_by_email
from syllabus_parser import parse_syllabus_with_gemini
from test_sorting import ask_gemini_to_sort, upload_to_drive, authenticate_drive
from drive_search import search_drive_files
from test_sorting import parse_search_intent # Or wherever you pasted the function above

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



load_dotenv()

# --- 1. SETUP SUPABASE CONNECTION ---
# Make sure these are in your .env file!
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") # Use Service Role Key for backend

# Initialize Client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

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
WHATSAPP_TOKEN = os.getenv("WHATSAPP_TOKEN")
PHONE_NUMBER_ID = os.getenv("PHONE_NUMBER_ID")
VERIFY_TOKEN = os.getenv("VERIFY_TOKEN")
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")

if not WHATSAPP_TOKEN or not PHONE_NUMBER_ID:
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
        "Authorization": f"Bearer {WHATSAPP_TOKEN}",
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
        "Authorization": f"Bearer {WHATSAPP_TOKEN}",
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


# --- HELPER: Download Media ---
def download_media(media_id, filename):
    try:
        url_info = f"https://graph.facebook.com/v17.0/{media_id}"
        headers = {"Authorization": f"Bearer {WHATSAPP_TOKEN}"}
        r = requests.get(url_info, headers=headers)
        media_url = r.json().get('url')

        r_media = requests.get(media_url, headers=headers)
        if r_media.status_code == 200:
            with open(filename, 'wb') as f:
                f.write(r_media.content)
            return True
    except:
        return False

#
# @app.post("/api/complete-setup")
# async def complete_setup(data: SetupRequest):
#     print(f"🚀 Starting Setup for {data.phone} with subjects: {data.subjects}")
#
#     # A. Validate User
#     user = get_user(data.phone)
#     if not user:
#         return JSONResponse({"error": "User not found"}, status_code=404)
#
#     # B. Prepare the Folder Structure
#     # We turn the list ["Physics"] into {"Physics": ["Unit 1", "Unit 2"...]}
#     # This is what your Drive function expects.
#     final_syllabus = {
#         subj: ["Unit 1", "Unit 2", "Unit 3", "Unit 4", "Unit 5"]
#         for subj in data.subjects
#     }
#
#     # C. Create Folders in Google Drive
#     try:
#         # NOTE: This function (build_drive_structure) must exist in your code.
#         # It connects to Google Drive and makes the folders.
#         root_id, new_map = build_drive_structure(data.phone, final_syllabus)
#
#         # D. Update Database
#         update_user(data.phone, "folder_map", new_map)
#         update_user(data.phone, "root_folder_id", root_id)
#         update_user(data.phone, "status", "ACTIVE")  # <--- Important! This unlocks the dashboard.
#
#         return {"status": "success"}
#
#     except Exception as e:
#         print(f"❌ Setup Error: {e}")
#         return JSONResponse({"status": "error", "message": str(e)}, status_code=500)
#
#

# Add to main.py
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

@app.post("/upload-syllabus")
async def upload_syllabus_web(request: Request, file: UploadFile = File(...)):
    phone = request.session.get("user_phone")
    if not phone: return JSONResponse({"error": "Not logged in"}, status_code=401)

    # 1. Save file locally
    temp_filename = f"syllabus_{phone}.pdf"
    with open(temp_filename, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # 2. Parse (Assuming returns dict: {"Maths": [...], "Physics": [...]})
    subjects_data = parse_syllabus_with_gemini(temp_filename)

    # 3. Save to DB
    update_user(phone, "temp_syllabus_list", subjects_data)
    update_user(phone, "status", "EDITING_LIST")

    # ✅ CORRECT: Send the full dictionary (Subjects + Units)
    return JSONResponse(content={"subjects": subjects_data})



# ==========================================
# 🤖 LOGIC 3: SORTING FILES (Active Mode)
# ==========================================
def process_file_background(media_id, sender, temp_filename):
    print(f"🔄 Processing file for {sender}...")

    if download_media(media_id, temp_filename):
        try:
            # 1. LOAD USER MAP
            user = get_user(sender)
            my_folders = user.get("folder_map", {})
            if isinstance(my_folders, str):
                try:
                    my_folders = json.loads(my_folders)
                except:
                    my_folders = {}

            if not my_folders:
                send_message(sender, "⚠️ No folders set up. Please go to the dashboard.")
                return

            # 2. ASK GEMINI TO SORT
            decision = ask_gemini_to_sort(temp_filename, my_folders)

            subj = decision.get('subject')
            unit = decision.get('unit')
            new_name = decision.get('suggested_filename', temp_filename)

            target_folder_id = None
            save_location_name = ""

            # 3. DETERMINE TARGET FOLDER (Auto-Sort Logic)

            # Case A: Exact Match (Subject + Unit found)
            if subj in my_folders and unit in my_folders[subj].get('units', {}):
                target_folder_id = my_folders[subj]['units'][unit]
                save_location_name = f"{subj} > {unit}"

            # Case B: Subject Match Only (Unit unknown/missing) -> Save to Subject Root
            elif subj in my_folders:
                target_folder_id = my_folders[subj]['id']
                save_location_name = f"{subj} (Root)"

            # Case C: Fallback / Utility Folders
            elif subj in ["Important Documents", "Screenshots", "Identity Cards", "Personal"]:
                # Check if these exist in the user's map (they should, from setup)
                if subj in my_folders:
                    target_folder_id = my_folders[subj]  # Might be string ID or dict depending on setup
                    if isinstance(target_folder_id, dict): target_folder_id = target_folder_id.get('id')
                    save_location_name = subj

            # Case D: No idea -> 'Imported Documents'
            if not target_folder_id:
                if "Imported Documents" in my_folders:
                    target = my_folders["Imported Documents"]
                    target_folder_id = target.get('id') if isinstance(target, dict) else target
                    save_location_name = "Imported Documents"
                else:
                    # Last resort: Root Folder
                    target_folder_id = user.get("root_folder_id")
                    save_location_name = "Home Folder"

            # 4. EXECUTE SAVE (No Buttons!)
            if target_folder_id:
                # Authenticate Drive
                drive_service = authenticate_drive(sender)

                # Upload
                upload_to_drive(drive_service, temp_filename, new_name, target_folder_id)

                # Notify User
                send_message(sender, f"✅ **Auto-Saved!**\n📂 *{save_location_name}*\n📄 _{new_name}_")
            else:
                send_message(sender, "❌ Error: Could not determine where to save this file.")

        except Exception as e:
            print(f"❌ Auto-Save Error: {e}")
            import traceback
            traceback.print_exc()
            send_message(sender, "❌ Failed to save file.")

        finally:
            # Cleanup temp file
            if os.path.exists(temp_filename):
                os.remove(temp_filename)
    else:
        send_message(sender, "❌ Failed to download file from WhatsApp.")




# ==========================================
# 👂 WEBHOOK LISTENER
# ==========================================
@app.post("/webhook")
async def receive_whatsapp(request: Request, background_tasks: BackgroundTasks):
    try:
        data = await request.json()

        # ---------------------------------------------------------
        # 🛡️ 1. SAFETY CHECKS (Standard Meta Boilerplate)
        # ---------------------------------------------------------
        if not data.get('entry') or not data['entry'][0].get('changes'):
            return Response(content="No valid entry", status_code=200)

        value = data['entry'][0]['changes'][0].get('value')

        # Ignore status updates (read receipts, etc.)
        if not value or 'messages' not in value:
            return Response(content="Status update ignored", status_code=200)

        # ---------------------------------------------------------
        # 📩 2. EXTRACT MESSAGE INFO
        # ---------------------------------------------------------
        msg = value['messages'][0]
        sender = msg['from']  # The phone number
        msg_type = msg['type']

        # ---------------------------------------------------------
        # 🔍 3. SUPABASE LOOKUP (Replacing get_user)
        # ---------------------------------------------------------
        user = {}
        status = "NEW"

        # Query the 'profiles' table for this phone number
        try:
            response = supabase.table('profiles').select("*").eq("phone", sender).execute()
            if response.data and len(response.data) > 0:
                user = response.data[0]  # Get the first result
                status = user.get('status', 'NEW')
        except Exception as e:
            print(f"⚠️ DB Error: {e}")

        # ============================================================
        # 🚀 4. VERIFICATION INTERCEPTOR (The Fix)
        # ============================================================
        if msg_type == 'text':
            text_body = msg.get('text', {}).get('body', '').strip().upper()

            if text_body == "VERIFY":
                # A. Check if user exists in Supabase
                if not user:
                    send_message(sender,
                                 "⚠️ *Account Not Found*\n\nPlease sign up at docflow.ai first, then message me.")
                    return Response(content="User not found", status_code=200)

                # B. Check if they have linked Google
                if not user.get("google_token"):
                    send_message(sender,
                                 "⚠️ *Google Login Missing*\n\nPlease login on the website to link your Google Drive.")
                    return Response(content="No Token", status_code=200)

                # C. Check Setup Progress & UPDATE STATUS
                # This update triggers the Realtime Listener in your React App!

                # If they already have a root folder, they are fully ACTIVE
                new_status = "ACTIVE" if user.get("root_folder_id") else "CONNECTED"

                # Update Supabase
                supabase.table('profiles').update({"status": new_status}).eq("phone", sender).execute()

                if new_status == "ACTIVE":
                    send_message(sender, "✅ *You are verified!* Send me a file to organize.")
                else:
                    send_message(sender,
                                 "✅ *Linked Successfully!* \n\nCheck your computer screen—you are being redirected. 🚀")

                return Response(content="Verified", status_code=200)

        # ============================================================
        # 🚦 5. STATUS HANDLER
        # ============================================================
        frontend_url = os.getenv("FRONTEND_URL", "https://your-app.vercel.app")

        # --- CASE A: NEW USER ---
        if status == "NEW":
            link = f"{frontend_url}/signup"
            send_message(sender,
                         "👋 *Welcome to DocOrganizer!* \n\n"
                         "Tap below to connect Google Drive & Setup Folders:\n"
                         f"{link}"
                         )
            # Optional: Update status to avoid spamming welcome message
            # supabase.table('profiles').update({"status": "AWAITING_LOGIN"}).eq("phone", sender).execute()

        # --- CASE B: PENDING SETUP ---
        elif status in ["CONNECTED", "AWAITING_SYLLABUS", "EDITING_LIST"]:
            send_message(sender,
                         "⏳ *Setup Incomplete* \n\n"
                         "Please finish setting up your subjects on the dashboard:\n"
                         f"👉 {frontend_url}/setup"
                         )

        # --- CASE C: ACTIVE USER (The Main Bot) ---
        elif status == "ACTIVE":

            # 1. TEXT MESSAGE -> SEARCH INTENT
            if msg_type == 'text':
                text_body = msg.get('text', {}).get('body', '')

                # A. Load Folder Map safely
                my_folders = user.get("folder_map", {})
                if isinstance(my_folders, str):
                    try:
                        my_folders = json.loads(my_folders)
                    except:
                        my_folders = {}

                # B. Check Intent
                intent = parse_search_intent(text_body, my_folders)
                is_search = intent.get("is_search")
                subject_match = intent.get("subject")

                if is_search:
                    send_message(sender, f"🔍 Searching for '{text_body}'...")

                    # C. Determine Folder ID
                    parent_id = None
                    if subject_match and subject_match in my_folders:
                        parent_id = my_folders[subject_match]['id']

                    # D. Call Search
                    files_found = search_drive_files(sender, text_body, parent_id)

                    if not files_found:
                        send_message(sender, "❌ No files found.")
                    else:
                        # E. Format Results
                        response_msg = f"📂 **Found {len(files_found)} files:**\n\n"
                        for f in files_found[:5]:
                            icon = "📄"
                            if "image" in f['mimeType']:
                                icon = "🖼️"
                            elif "pdf" in f['mimeType']:
                                icon = "📕"
                            elif "folder" in f['mimeType']:
                                icon = "📁"

                            response_msg += f"{icon} *{f['name']}*\n🔗 {f['webViewLink']}\n\n"

                        send_message(sender, response_msg)

                else:
                    send_message(sender, "📤 Send me a file to save, or ask 'Find Adhar Card'.")

            # 2. FILE MESSAGE -> SORTING INTENT
            elif msg_type in ['document', 'image']:
                # Ensure the media key exists before accessing
                if msg_type in msg:
                    media_id = msg[msg_type]['id']

                    # Determine extension
                    ext = ".jpg"
                    if msg_type == 'document':
                        mime = msg['document'].get('mime_type', '')
                        if "pdf" in mime:
                            ext = ".pdf"
                        elif "word" in mime:
                            ext = ".docx"

                    temp_filename = f"file_{sender}{ext}"

                    send_message(sender, "🤖 Analyzing document...")
                    background_tasks.add_task(process_file_background, media_id, sender, temp_filename)

            # 3. BUTTON CLICKS
            elif msg_type == 'interactive':
                btn_id = msg['interactive']['button_reply']['id']

                if sender in pending_actions:
                    action = pending_actions[sender]

                    if btn_id == "save_file":
                        send_message(sender, "🚀 Uploading to Drive...")
                        try:
                            drive_service = authenticate_drive(sender)
                            upload_to_drive(drive_service, action['local_path'], action['new_name'],
                                            action['drive_folder_id'])
                            send_message(sender, f"✅ Saved to *{action['subject']}*")
                        except Exception as e:
                            send_message(sender, f"❌ Upload failed: {e}")

                        if os.path.exists(action['local_path']): os.remove(action['local_path'])
                        del pending_actions[sender]

                    elif btn_id == "discard_file":
                        send_message(sender, "🚫 Discarded.")
                        if os.path.exists(action['local_path']): os.remove(action['local_path'])
                        del pending_actions[sender]

    except Exception as e:
        print(f"❌ Webhook Error: {e}")
        # Return 200 OK so Meta doesn't keep retrying the broken message
        return Response(content="Internal Error", status_code=200)

    return Response(content="OK", status_code=200)



# --- VERIFY WEBHOOK ---
@app.get("/webhook")
async def verify(request: Request):
    if request.query_params.get("hub.verify_token") == VERIFY_TOKEN:
        return int(request.query_params.get("hub.challenge"))
    return Response("Forbidden", 403)