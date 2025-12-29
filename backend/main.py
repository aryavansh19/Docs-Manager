import os
import time
import requests
import json
from fastapi import FastAPI, Request, BackgroundTasks, Response
from dotenv import load_dotenv

import io
from googleapiclient.http import MediaIoBaseDownload

# --- IMPORTS FROM OUR NEW MODULES ---
from database import get_user, update_user, get_user_by_email
from syllabus_parser import parse_syllabus_with_gemini
from test_sorting import ask_gemini_to_sort, upload_to_drive, authenticate_drive
from drive_search import search_drive_files
from test_sorting import parse_search_intent # Or wherever you pasted the function above

from folder_creator import build_drive_structure
from fastapi.responses import JSONResponse, RedirectResponse

from starlette.middleware.sessions import SessionMiddleware
from fastapi.responses import RedirectResponse
from fastapi.templating import Jinja2Templates
from fastapi import UploadFile, File
import shutil

from fastapi.middleware.cors import CORSMiddleware
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials


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
    allow_origins=[
        "http://localhost:5173",
        "https://aryavansh.dev",
        "https://www.aryavansh.dev"
    ],
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


# --- ROUTE 1: SMART LOGIN HANDLER ---
@app.get("/login")
def login(request: Request):
    # Check if phone was provided (Door A: Signup)
    phone = request.query_params.get("phone")

    # We still try to save to session as a backup, but we don't rely on it
    if phone:
        print(f"DEBUG: Signup Request for {phone}")
        request.session["user_phone"] = phone
    else:
        print(f"DEBUG: Direct Login Request (No Phone)")
        if "user_phone" in request.session:
            del request.session["user_phone"]

    # --- GOOGLE OAUTH SETUP ---
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    current_backend_url = os.getenv("BACKEND_URL", "http://localhost:8001")
    redirect_uri = f"{current_backend_url}/auth/callback"

    scope = "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/userinfo.email"

    # 🛑 CRITICAL FIX: PREPARE THE 'STATE' PARAMETER
    # If we have a phone, we put it in the 'state'. If not, we send "null".
    # This ensures the phone number survives the trip to Google and back.
    state_value = phone if phone else "null"

    # Add &state={state_value} to the URL 👇
    url = (
        f"https://accounts.google.com/o/oauth2/v2/auth?"
        f"response_type=code&"
        f"client_id={client_id}&"
        f"redirect_uri={redirect_uri}&"
        f"scope={scope}&"
        f"access_type=offline&"
        f"prompt=select_account&"
        f"state={state_value}"  # <--- THIS IS THE MAGIC FIX
    )

    return RedirectResponse(url)

# --- ROUTE 2: THE CALLBACK (THE BRAIN) ---
@app.get("/auth/callback")
def auth_callback(request: Request):
    print("🚀 Auth Callback started!")

    code = request.query_params.get("code")

    # [CHANGE 1] Get phone from the URL 'backpack' (State)
    state_phone = request.query_params.get("state")

    # [CHANGE 2] Get phone from Session (Backup)
    session_phone = request.session.get("user_phone")

    print(f"DEBUG: Code: {bool(code)} | State: {state_phone} | Session: {session_phone}")

    if not code:
        return "❌ Error: Missing code."

    # 1. Exchange Code for Tokens
    token_url = "https://oauth2.googleapis.com/token"

    # Use environment variable for backend URL
    current_backend_url = os.getenv("BACKEND_URL", "http://localhost:8001")
    redirect_uri = f"{current_backend_url}/auth/callback"

    data = {
        "code": code,
        "client_id": os.getenv("GOOGLE_CLIENT_ID"),
        "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code"
    }

    try:
        response = requests.post(token_url, data=data)
        new_tokens = response.json()
        access_token = new_tokens.get("access_token")

        # 2. Fetch Google Profile
        user_info = requests.get(
            "https://www.googleapis.com/oauth2/v1/userinfo",
            headers={"Authorization": f"Bearer {access_token}"}
        ).json()

        google_email = user_info.get("email")
        user_name = user_info.get("name", "Student")
        user_pic = user_info.get("picture", "")

        print(f"DEBUG: Google Email found: {google_email}")

    except Exception as e:
        return f"❌ Error connecting to Google: {str(e)}"

    final_phone = None

    # --- LOGIC BRANCHING (Fixed) ---

    # [CHANGE 3] Check State FIRST, then Session. If either exists, we are in "Door A" (Signup/Linking)
    if (state_phone and state_phone != "null") or session_phone:
        # Use state_phone if available, otherwise fallback to session_phone
        target_phone = state_phone if (state_phone and state_phone != "null") else session_phone

        print(f"🔗 Linking {google_email} to {target_phone}")
        update_user(target_phone, "email", google_email)
        final_phone = target_phone

    else:
        # === DOOR B: DIRECT LOGIN ===
        # We don't have a phone number, so we must find it using the email
        print(f"🔍 Looking up user by email: {google_email}")
        existing_user = get_user_by_email(google_email)

        if existing_user:
            final_phone = existing_user['phone']

            # Handle Refresh Token logic (Keep old refresh token if new one is missing)
            if existing_user.get("google_token"):
                old_tokens = existing_user["google_token"]
                if isinstance(old_tokens, str):
                    old_tokens = json.loads(old_tokens)

                if "refresh_token" not in new_tokens:
                    new_tokens["refresh_token"] = old_tokens.get("refresh_token")
        else:
            # If we can't find the user and they didn't provide a phone, we can't log them in.
            return RedirectResponse(
                url=f"{os.getenv('FRONTEND_URL')}/?error=account_not_found"
            )

    # 3. Save Updates (Running for EVERYONE now)
    update_user(final_phone, "google_token", new_tokens)
    update_user(final_phone, "name", user_name)
    update_user(final_phone, "picture", user_pic)
    update_user(final_phone, "email", google_email)

    # 🛑 FORCE COOKIE REFRESH
    # This is critical for Vercel <-> Render communication
    request.session["user_phone"] = final_phone

    # 4. Redirect based on Status
    user = get_user(final_phone)
    status = user.get("status", "NEW")

    # Define frontend_url
    frontend_url = os.getenv("FRONTEND_URL", "https://docs-manager-iota.vercel.app")

    if status == "ACTIVE":
        # Full user -> Dashboard
        target_url = f"{frontend_url}/dashboard"

    elif status in ["CONNECTED", "AWAITING_SYLLABUS", "EDITING_LIST"]:
        # Partially setup -> Setup Wizard
        target_url = f"{frontend_url}/setup"

    else:
        # === CHANGE IS HERE ===
        # If status is "NEW", DO NOT auto-upgrade.
        # Send them to /verify so they MUST send the WhatsApp message.
        target_url = f"{frontend_url}/verify"

    print(f"🚀 Redirecting {final_phone} to {target_url}")
    return RedirectResponse(url=target_url, status_code=303)


@app.post("/api/complete-setup")
async def complete_setup(data: SetupRequest):
    print(f"🚀 Starting Setup for {data.phone} with subjects: {data.subjects}")

    # A. Validate User
    user = get_user(data.phone)
    if not user:
        return JSONResponse({"error": "User not found"}, status_code=404)

    # B. Prepare the Folder Structure
    # We turn the list ["Physics"] into {"Physics": ["Unit 1", "Unit 2"...]}
    # This is what your Drive function expects.
    final_syllabus = {
        subj: ["Unit 1", "Unit 2", "Unit 3", "Unit 4", "Unit 5"]
        for subj in data.subjects
    }

    # C. Create Folders in Google Drive
    try:
        # NOTE: This function (build_drive_structure) must exist in your code.
        # It connects to Google Drive and makes the folders.
        root_id, new_map = build_drive_structure(data.phone, final_syllabus)

        # D. Update Database
        update_user(data.phone, "folder_map", new_map)
        update_user(data.phone, "root_folder_id", root_id)
        update_user(data.phone, "status", "ACTIVE")  # <--- Important! This unlocks the dashboard.

        return {"status": "success"}

    except Exception as e:
        print(f"❌ Setup Error: {e}")
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)


@app.get("/api/dashboard-data")
def get_dashboard_data(request: Request):
    phone = request.session.get("user_phone")
    if not phone: return JSONResponse({"error": "Not logged in"}, status_code=401)

    user = get_user(phone)
    if not user: return JSONResponse({"error": "User not found"}, status_code=404)

    return {
        "phone": phone,
        "name": user.get("name"),
        "picture": user.get("picture"),
        "status": user.get("status"),
        "syllabus": user.get("temp_syllabus_list", {}),
        "folder_map": user.get("folder_map", {}),
        # 👇 ADD THIS LINE HERE 👇
        "root_folder_id": user.get("root_folder_id")
    }


@app.get("/api/drive/browse")
def browse_drive(request: Request, folder_id: str = None):
    # 1. Auth Check
    phone = request.session.get("user_phone")
    user = get_user(phone)
    if not user or not user.get("google_token"):
        return JSONResponse({"error": "Auth required"}, 401)

    # 2. Setup Drive Service
    token_info = user['google_token']

    # --- FIX: Convert String to JSON if needed ---
    if isinstance(token_info, str):
        try:
            token_info = json.loads(token_info)
        except Exception as e:
            print(f"❌ Token Parsing Error: {e}")
            return JSONResponse({"error": "Invalid Token Format"}, 500)
    # --------------------------------------------

    creds = Credentials(
        token=token_info['access_token'],
        refresh_token=token_info.get('refresh_token'),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.getenv("GOOGLE_CLIENT_ID"),
        client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
    )
    service = build('drive', 'v3', credentials=creds)

    # 3. Determine which folder to look in
    target_id = folder_id
    if not target_id:
        target_id = user.get("root_folder_id")

    if not target_id:
        return {"folders": [], "files": []}

    try:
        # 4. Query Drive
        query = f"'{target_id}' in parents and trashed=false"
        results = service.files().list(
            q=query,
            fields="files(id, name, mimeType, webViewLink, iconLink)",
            orderBy="folder, name"
        ).execute()

        items = results.get('files', [])

        # 5. Separate logic
        folders = []
        files = []
        for item in items:
            if item['mimeType'] == 'application/vnd.google-apps.folder':
                folders.append(item)
            else:
                files.append(item)

        return {"folders": folders, "files": files}

    except Exception as e:
        print(f"Drive API Error: {e}")
        return JSONResponse({"error": str(e)}, 500)


@app.get("/logout")
def logout(request: Request):
    # 1. Clear the session cookie
    request.session.clear()

    # 2. Redirect to the Frontend Login Page
    return RedirectResponse(f"{frontend_url}/login")


def append_folders_to_drive(phone, root_folder_id, new_structure):
    """
    Creates ONLY the folders in 'new_structure' inside the EXISTING 'root_folder_id'.
    Returns a dictionary of the newly created folders.
    """

    # 1. USE YOUR EXISTING AUTH FUNCTION
    # This returns the 'service' object directly
    service = authenticate_drive(phone)

    created_map = {}
    print(f"📂 Appending to Root ID: {root_folder_id}")

    for subject_name, units in new_structure.items():
        try:
            # 2. Create Subject Folder
            file_metadata = {
                'name': subject_name,
                'mimeType': 'application/vnd.google-apps.folder',
                'parents': [root_folder_id]
            }
            subject_folder = service.files().create(body=file_metadata, fields='id').execute()
            subject_id = subject_folder.get('id')

            # 3. Add to local map (to save to DB later)
            created_map[subject_name] = {
                "id": subject_id,
                "units": {}
            }

            # 4. Create Unit Subfolders
            for unit_name in units:
                unit_metadata = {
                    'name': unit_name,
                    'mimeType': 'application/vnd.google-apps.folder',
                    'parents': [subject_id]
                }
                unit_folder = service.files().create(body=unit_metadata, fields='id').execute()
                created_map[subject_name]["units"][unit_name] = unit_folder.get('id')

            print(f"✅ Created {subject_name}")

        except Exception as e:
            print(f"❌ Failed to create {subject_name}: {e}")

    return created_map


@app.post("/create-folders")
async def create_folders_web(request: Request):
    phone = request.session.get("user_phone")
    if not phone: return RedirectResponse("/")

    # 1. Get Inputs
    form = await request.form()
    selected_subjects = form.getlist("selected_subjects")  # List of subjects to create

    # 2. Get User Data
    user = get_user(phone)
    root_id = user.get("root_folder_id")

    # Load Syllabus Data (to get units)
    full_syllabus_str = user.get("temp_syllabus_list", "{}")
    full_syllabus = {}
    if isinstance(full_syllabus_str, str):
        try:
            full_syllabus = json.loads(full_syllabus_str)
        except:
            full_syllabus = {}
    elif isinstance(full_syllabus_str, dict):
        full_syllabus = full_syllabus_str

    # Load Existing Map (to avoid duplicates or data loss)
    existing_map_str = user.get("folder_map", "{}")
    existing_map = {}
    if isinstance(existing_map_str, str):
        try:
            existing_map = json.loads(existing_map_str)
        except:
            existing_map = {}
    elif isinstance(existing_map_str, dict):
        existing_map = existing_map_str

    # ======================================================
    # 🛑 MODE 1: APPEND (If Root Folder Exists)
    # ======================================================
    if root_id:
        print("🔄 Mode: APPEND (Adding to existing workspace)")

        # Build structure ONLY for the selected subjects
        structure_to_add = {}
        for subj in selected_subjects:
            # Skip if folder already exists in DB map
            if subj in existing_map:
                print(f"⚠️ Skipping {subj}, already exists.")
                continue
            structure_to_add[subj] = full_syllabus.get(subj, [])

        if not structure_to_add:
            return JSONResponse({"status": "success", "message": "No new folders to create."})

        # Call the Helper
        newly_created_map = append_folders_to_drive(phone, root_id, structure_to_add)

        # MERGE: Add new folders to existing map
        existing_map.update(newly_created_map)

        # Save to DB
        update_user(phone, "folder_map", existing_map)

        return JSONResponse({"status": "success", "message": "New subjects added successfully"})


    # ======================================================
    # 🚀 MODE 2: INITIAL SETUP (If No Root Folder)
    # ======================================================
    else:
        print("✨ Mode: INITIAL SETUP (Creating Root + Defaults)")

        # Build structure for selected subjects
        final_structure = {}
        for subj in selected_subjects:
            final_structure[subj] = full_syllabus.get(subj, [])

        # INJECT DEFAULTS (Only doing this because it's the first run)
        defaults = {
            "Important Documents": ["Aadhar Card", "PAN Card", "Resumes", "Mark sheets"],
            "Screenshots": ["Notes", "Receipts", "Payments"],
            "Identity Cards": ["College ID", "Govt ID"],
            "Personal": [],
            "Imported Documents": []
        }
        for k, v in defaults.items():
            if k not in final_structure:
                final_structure[k] = v

        # Create EVERYTHING (Root + Children)
        try:
            new_root_id, new_map = build_drive_structure(phone, final_structure)

            update_user(phone, "folder_map", new_map)
            update_user(phone, "root_folder_id", new_root_id)
            update_user(phone, "status", "ACTIVE")

            # Message 1: Confirmation
            send_message(phone, "✅ *Setup Complete!*\nYour dashboard and folders are ready.")

            # Message 2: How to use (Onboarding)
            intro_msg = (
                "🚀 *How to use me:*\n\n"
                "1️⃣ *Save Files:* Send any image or PDF here. I will analyze it and auto-sort it into the correct Subject folder.\n\n"
                "2️⃣ *Find Files:* Just ask things like _'Get Physics notes'_ or _'Find Unit 1 papers'_ and I'll fetch them instantly!"
            )
            send_message(phone, intro_msg)

            return JSONResponse({"status": "success", "message": "Workspace created successfully"})

        except Exception as e:
            print(f"❌ Creation Error: {e}")
            return JSONResponse({"error": str(e)}, status_code=500)


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
        # 🛡️ 1. SAFETY CHECKS (Prevent Crashing on Status Updates)
        # ---------------------------------------------------------
        # Check if 'entry' exists
        if not data.get('entry'):
            return Response(content="No entry", status_code=200)

        # Get the first entry safely
        entry_list = data['entry']
        if not entry_list:
            return Response(content="Empty entry list", status_code=200)

        changes_list = entry_list[0].get('changes')
        if not changes_list:
            return Response(content="No changes", status_code=200)

        # Get the value object
        value = changes_list[0].get('value')
        if not value:
            return Response(content="No value", status_code=200)

        # 🛑 IGNORE STATUS UPDATES (Sent, Delivered, Read)
        # These updates don't have 'messages', so we skip them to avoid crashes.
        if 'messages' not in value:
            return Response(content="Status update ignored", status_code=200)

        # ---------------------------------------------------------
        # 📩 2. PROCESS ACTUAL MESSAGE
        # ---------------------------------------------------------
        msg = value['messages'][0]
        sender = msg['from']
        msg_type = msg['type']

        # 🛡️ SAFETY CHECK: Handle users who aren't in DB yet
        user = get_user(sender)

        if user:
            status = user.get('status', 'NEW')
        else:
            # If user is None (not found), treat them as NEW and use empty dict to prevent crashes
            status = "NEW"
            user = {}

            # ============================================================
        # 🚀 3. VERIFICATION INTERCEPTOR
        # ============================================================
        if msg_type == 'text':
            # Safely get body (some text messages might be empty or location pins)
            text_body = msg.get('text', {}).get('body', '').strip().upper()

            if text_body == "VERIFY":
                # Ensure user exists and has google_token
                if user and user.get("google_token"):
                    # If they are verified, we check if they finished setup
                    if user.get("root_folder_id"):
                        update_user(sender, "status", "ACTIVE")
                        send_message(sender, "✅ *You are ready!* Send me a file to organize.")
                    else:
                        # They are verified but haven't run the wizard
                        update_user(sender, "status", "CONNECTED")
                        send_message(sender,
                                     "✅ *Linked Successfully!*\n\n"
                                     "Proceed to your dashboard to setup your folders. 📂"
                                     )
                else:
                    send_message(sender,
                                 "⚠️ *Verification Failed* \nLogin on the website first, then type VERIFY here.")
                return "OK"

        # ============================================================
        # 🚦 4. STATUS HANDLER
        # ============================================================

        # Define frontend_url for links (Use env variable)
        frontend_url = os.getenv("FRONTEND_URL", "https://your-app.vercel.app")

        # --- CASE A: NEW USER (Needs to Login) ---
        if status == "NEW" or status == "AWAITING_LOGIN":
            base_url = os.getenv("BACKEND_URL", "https://your-backend.onrender.com")
            # We send them to the FRONTEND login page now, or backend?
            # Usually better to send to frontend:
            link = f"{frontend_url}/?phone={sender}"  # Or keep your logic if it works

            send_message(sender,
                         "👋 *Welcome to DocOrganizer!* \n\n"
                         "Tap below to connect Google Drive & Setup Folders:\n"
                         f"{link}"
                         )
            update_user(sender, "status", "AWAITING_LOGIN")

        # --- CASE B: PENDING SETUP (Needs to finish Website Wizard) ---
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