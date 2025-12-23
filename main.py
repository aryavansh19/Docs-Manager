import os
import time
import requests
import json
from fastapi import FastAPI, Request, BackgroundTasks, Response
from dotenv import load_dotenv

# --- IMPORTS FROM OUR NEW MODULES ---
from database import get_user, update_user
from syllabus_parser import parse_syllabus_with_gemini
from folder_creator import build_drive_structure
from test_sorting import ask_gemini_to_sort, upload_to_drive, authenticate_drive
from drive_search import search_drive_files
from test_sorting import parse_search_intent # Or wherever you pasted the function above

from folder_creator import build_drive_structure
from starlette.responses import RedirectResponse

from starlette.middleware.sessions import SessionMiddleware
from fastapi.responses import RedirectResponse
from fastapi.templating import Jinja2Templates
from fastapi import UploadFile, File
import shutil

# Setup Templates
templates = Jinja2Templates(directory="templates")
app = FastAPI()

# Add Session Middleware (Encrypts cookies)
# "secret-key" should be random. In production, use os.getenv("SECRET_KEY")
app.add_middleware(SessionMiddleware, secret_key="super-secret-random-string")

load_dotenv()

#app = FastAPI()

# --- CONFIG ---
WHATSAPP_TOKEN = os.getenv("WHATSAPP_TOKEN")
PHONE_NUMBER_ID = os.getenv("PHONE_NUMBER_ID")
VERIFY_TOKEN = os.getenv("VERIFY_TOKEN")

if not WHATSAPP_TOKEN or not PHONE_NUMBER_ID:
    raise ValueError("❌ Missing Keys! Check your .env file.")

# --- MEMORY FOR BUTTONS ---
pending_actions = {}


# --- ROUTE 1: SHOW LOGIN PAGE ---
@app.get("/")
def home(request: Request):
    # Check if user is already logged in (has cookie)
    user_info = request.session.get('user')
    if user_info:
        return f"✅ Logged in as: {user_info.get('email')}"
    return templates.TemplateResponse("login.html", {"request": request})


# --- ROUTE 2: REDIRECT TO GOOGLE
@app.get("/login")
def login(request: Request):
    # Get the phone number from the URL (?phone=...)
    phone = request.query_params.get("phone")

    if not phone:
        return "❌ Error: Missing phone number. Please click the link from WhatsApp again."

    # Save phone in a cookie so we remember it after they come back from Google
    request.session["user_phone"] = phone

    client_id = os.getenv("GOOGLE_CLIENT_ID")
    redirect_uri = "http://localhost:8000/auth/callback"
    scope = "https://www.googleapis.com/auth/drive"

    url = f"https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id={client_id}&redirect_uri={redirect_uri}&scope={scope}&access_type=offline&prompt=consent"

    return RedirectResponse(url)


# Import database functions if not already there
from database import update_user, get_user


@app.get("/auth/callback")
def auth_callback(request: Request):
    code = request.query_params.get("code")
    if not code: return "❌ Error: No code received."

    # 1. Exchange Code for Token
    token_url = "https://oauth2.googleapis.com/token"
    data = {
        "code": code,
        "client_id": os.getenv("GOOGLE_CLIENT_ID"),
        "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
        "redirect_uri": "http://localhost:8000/auth/callback",
        "grant_type": "authorization_code"
    }

    r = requests.post(token_url, data=data)
    tokens = r.json()

    # 2. Retrieve the phone number we saved in the cookie
    phone = request.session.get("user_phone")

    if not phone:
        return "❌ Error: Session lost. Try clicking the WhatsApp link again."

    # 3. SAVE TO DATABASE!
    # We save the entire token JSON (access_token + refresh_token)
    update_user(phone, "google_token", tokens)
    update_user(phone, "status", "CONNECTED")  # Update status

    # Inside auth_callback function... after saving to DB:
    return RedirectResponse(url="/dashboard", status_code=303)


@app.post("/create-folders")
async def create_folders_web(request: Request):
    phone = request.session.get("user_phone")
    if not phone: return RedirectResponse("/")

    # 1. Get the Form Data (Which subjects did they check?)
    form = await request.form()
    selected_subjects = form.getlist("selected_subjects")  # List of subject names

    # 2. Get the full syllabus from DB
    user = get_user(phone)
    full_syllabus = user.get("temp_syllabus_list", {})

    # 3. Filter the list (Keep only selected subjects)
    final_syllabus = {k: v for k, v in full_syllabus.items() if k in selected_subjects}

    # 4. BUILD THE FOLDERS (Using your existing logic!)
    # Note: build_drive_structure usually takes ~10-20 seconds.
    # For a pro website, use BackgroundTasks. For now, we wait.
    try:
        root_id, new_map = build_drive_structure(phone, final_syllabus)

        # 5. Save Final State
        update_user(phone, "folder_map", new_map)
        update_user(phone, "root_folder_id", root_id)
        update_user(phone, "status", "ACTIVE")

        # 6. Notify on WhatsApp
        send_message(phone, "✅ **Setup Complete!**\nYour folders are ready. Send me a file now!")

        return "🎉 Success! You can close this page and go back to WhatsApp."

    except Exception as e:
        return f"❌ Error creating folders: {e}"

@app.get("/dashboard")
def dashboard(request: Request):
    phone = request.session.get("user_phone")
    if not phone: return RedirectResponse("/")

    # 1. Get User Data from DB
    user = get_user(phone)

    # 2. Get the Syllabus List (if it exists)
    syllabus = user.get("temp_syllabus_list", {})
    status = user.get("status")

    # 3. Send everything to the HTML template
    return templates.TemplateResponse("dashboard.html", {
        "request": request,
        "syllabus": syllabus,
        "status": status
    })


@app.post("/upload-syllabus")
async def upload_syllabus_web(request: Request, file: UploadFile = File(...)):
    phone = request.session.get("user_phone")
    if not phone: return RedirectResponse("/")

    # 1. Save the file temporarily
    temp_filename = f"syllabus_{phone}.pdf"
    with open(temp_filename, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # 2. Parse with Gemini
    subjects = parse_syllabus_with_gemini(temp_filename)

    # 3. Save to DB and Update Status
    update_user(phone, "temp_syllabus_list", subjects)
    update_user(phone, "status", "EDITING_LIST")

    # --- FIX: Redirect back to dashboard instead of returning text ---
    return RedirectResponse(url="/dashboard", status_code=303)


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


# ==========================================
# 🧠 LOGIC 1: SYLLABUS SETUP (Phase 2)
# ==========================================
def handle_syllabus_setup(media_id, sender, temp_filename):
    send_message(sender, "🧐 Reading your syllabus... (This takes ~10s)")

    if download_media(media_id, temp_filename):
        subjects = parse_syllabus_with_gemini(temp_filename)

        if subjects:
            update_user(sender, "temp_syllabus_list", subjects)
            update_user(sender, "status", "EDITING_LIST")

            msg = "✅ **Analysis Complete!**\nI found these subjects:\n\n"
            for subject, units in subjects.items():
                msg += f"📂 *{subject}* ({len(units)} units)\n"

            msg += "\n👇 **What next?**\n- Reply *'Add [Subject]'*\n- Reply *'Remove [Subject]'*\n- Click Confirm below."

            send_buttons(sender, msg, [{"id": "setup_confirm", "title": "✅ Confirm"}])
        else:
            send_message(sender, "❌ I couldn't read that file. Try a clearer PDF.")
    else:
        send_message(sender, "❌ Download failed.")


# ==========================================
# 🏗️ LOGIC 2: CREATE FOLDERS (Phase 4)
# ==========================================
def create_user_folders(sender):
    user = get_user(sender)
    final_list = user.get("temp_syllabus_list", {})

    if not final_list:
        send_message(sender, "❌ Error: Session expired. Upload syllabus again.")
        return

    send_message(sender, "🚀 Creating folders in Google Drive... (Wait ~20s)")

    try:
        root_id, new_map = build_drive_structure(sender, final_list)

        update_user(sender, "folder_map", new_map)
        update_user(sender, "root_folder_id", root_id)
        update_user(sender, "status", "ACTIVE")

        send_message(sender,
                     "✅ **Setup Complete!**\n\nI created 'Smart Docs' in your Drive.\n👉 Send me a PDF notes file now!")
    except Exception as e:
        print(f"Build Error: {e}")
        send_message(sender, "❌ Creating folders failed.")


# ==========================================
# 🤖 LOGIC 3: SORTING FILES (Active Mode)
# ==========================================
def process_file_background(media_id, sender, temp_filename):
    print(f"🔄 Processing file for {sender}...")

    if download_media(media_id, temp_filename):
        try:
            # 1. LOAD USER MAP FROM DB
            user = get_user(sender)
            my_folders = user.get("folder_map", {})

            if not my_folders:
                send_message(sender, "⚠️ Setup not found. Send 'Hi' to restart.")
                return

            # 2. Ask Gemini to Sort
            decision = ask_gemini_to_sort(temp_filename, my_folders)

            subj = decision['subject']
            unit = decision['unit']
            new_name = decision['suggested_filename']

            # 3. Check & Prepare
            if subj in my_folders and unit in my_folders[subj]['units']:
                folder_id = my_folders[subj]['units'][unit]

                # Save state for button click
                pending_actions[sender] = {
                    "local_path": temp_filename,
                    "drive_folder_id": folder_id,
                    "new_name": new_name,
                    "subject": subj
                }

                msg = (f"🧐 *Analysis:*\n📂 {subj}\n📝 {unit}\n📄 _{new_name}_")

                buttons = [
                    {"id": "save_file", "title": "✅ Save"},
                    {"id": "discard_file", "title": "❌ Discard"}
                ]
                send_buttons(sender, msg, buttons)
            else:
                send_message(sender, f"⚠️ AI identified '{subj}', but it's not in your syllabus folders.")

        except Exception as e:
            print(f"❌ Error: {e}")
            send_message(sender, "❌ Error analyzing file.")
    else:
        send_message(sender, "❌ Failed to download file.")


# ==========================================
# 👂 WEBHOOK LISTENER
# ==========================================
@app.post("/webhook")
async def receive_whatsapp(request: Request, background_tasks: BackgroundTasks):
    data = await request.json()

    try:
        entry = data['entry'][0]['changes'][0]['value']
        if 'messages' in entry:
            msg = entry['messages'][0]
            sender = msg['from']
            msg_type = msg['type']

            user = get_user(sender)
            status = user['status']

            # --- NEW USER ---
            if status == "NEW":
                # 1. GET NGROK URL (Or hardcode it if you know it)
                # You should put your current Ngrok URL in .env as BASE_URL
                base_url = os.getenv("BASE_URL", "https://867441fb641f.ngrok-free.app")
                # 2. Generate the correct Mobile Link
                link = f"{base_url}/login?phone={sender}"

                # 3. Send a Clean Message with a Link Preview
                msg = (
                    "👋 *Welcome to DocOrganizer!* \n\n"
                    "I can organize your files automatically, but first I need permission to access your Google Drive.\n\n"
                    f"👇 *Tap here to Connect:*\n{link}"
                )
                # Use standard send_message, but ensure 'preview_url' is enabled (default is usually yes)
                send_message(sender, msg)
                update_user(sender, "status", "AWAITING_LOGIN")

            # --- SETUP: AWAITING SYLLABUS ---
            elif status == "AWAITING_SYLLABUS":
                if msg_type in ['document', 'image']:
                    media_id = msg[msg_type]['id']
                    ext = ".pdf" if msg_type == "document" else ".jpg"
                    temp = f"syllabus_{sender}{ext}"
                    background_tasks.add_task(handle_syllabus_setup, media_id, sender, temp)
                else:
                    send_message(sender, "⚠️ Please send a PDF/Image of your syllabus.")

            # --- SETUP: EDITING LIST ---
            elif status == "EDITING_LIST":
                if msg_type == 'interactive':
                    btn_id = msg['interactive']['button_reply']['id']
                    if btn_id == "setup_confirm":
                        background_tasks.add_task(create_user_folders, sender)

                elif msg_type == 'text':
                    text = msg['text']['body'].strip()
                    current_list = user['temp_syllabus_list']

                    if text.lower() == "confirm":
                        background_tasks.add_task(create_user_folders, sender)
                    elif text.lower().startswith("add "):
                        new_subj = text[4:].strip()
                        current_list[new_subj] = ["Unit 1", "Unit 2", "Unit 3", "Unit 4", "Unit 5"]
                        update_user(sender, "temp_syllabus_list", current_list)
                        send_message(sender, f"✅ Added {new_subj}. Reply 'Confirm' when done.")
                    elif text.lower().startswith("remove "):
                        rem_subj = text[7:].strip()
                        found = next((k for k in current_list if rem_subj.lower() in k.lower()), None)
                        if found:
                            del current_list[found]
                            update_user(sender, "temp_syllabus_list", current_list)
                            send_message(sender, f"🗑️ Removed {found}.")
                        else:
                            send_message(sender, "⚠️ Subject not found.")

            # --- ACTIVE USER (SORTING) ---
            elif status == "ACTIVE":
                if msg_type == 'text':
                    text_body = msg['text']['body']
                    user = get_user(sender)
                    my_folders = user.get("folder_map", {})

                    # 1. Ask Gemini: Is this a search?
                    analysis = parse_search_intent(text_body, my_folders)

                    if analysis.get("is_search"):
                        subj = analysis.get("subject")

                        if subj in my_folders:
                            # Get the Subject Folder ID
                            # (Or you can go deeper into Units if Gemini is smart enough)
                            target_id = my_folders[subj]['id']

                            send_message(sender, f"🔍 Searching in *{subj}*...")

                            # 2. Search Drive
                            files = search_drive_files(target_id,sender)

                            if files:
                                response_msg = f"📂 **Files found in {subj}:**\n\n"
                                for f in files:
                                    response_msg += f"📄 {f['name']}\n🔗 {f['webViewLink']}\n\n"
                                send_message(sender, response_msg)
                            else:
                                send_message(sender, f"❌ No files found in the {subj} folder.")
                        else:
                            send_message(sender, "⚠️ I couldn't match that to a folder in your syllabus.")

                    else:
                        # Fallback for non-search chat
                        send_message(sender, "Send me a file to save, or ask me 'Get Physics notes'!")

                elif msg_type in ['document', 'image']:
                    media_id = msg[msg_type]['id']
                    ext = ".pdf" if msg_type == "document" else ".jpg"
                    if msg_type == 'document' and "pdf" in msg['document'].get('mime_type', ''):
                        ext = ".pdf"

                    temp = f"file_{sender}{ext}"
                    send_message(sender, "🤖 Analyzing...")
                    background_tasks.add_task(process_file_background, media_id, sender, temp)

                # HANDLE SAVE/DISCARD CLICKS
                elif msg_type == 'interactive':
                    btn_id = msg['interactive']['button_reply']['id']
                    if sender in pending_actions:
                        action = pending_actions[sender]
                        if btn_id == "save_file":
                            send_message(sender, "🚀 Uploading...")
                            try:
                                drive_service = authenticate_drive(sender)
                                upload_to_drive(drive_service, action['local_path'], action['new_name'],
                                                action['drive_folder_id'])
                                send_message(sender, f"✅ Saved to *{action['subject']}*")
                            except Exception as e:
                                send_message(sender, f"❌ Upload failed: {e}")

                                # --- SAFE CLEANUP FIX ---
                            try:
                                time.sleep(1)  # Wait 1s for Windows to release the file
                                if os.path.exists(action['local_path']):
                                    os.remove(action['local_path'])
                            except Exception as cleanup_error:
                                print(f"⚠️ Could not delete temp file (locked): {cleanup_error}")
                                # ------------------------

                            del pending_actions[sender]

                        elif btn_id == "discard_file":
                            send_message(sender, "🚫 Discarded.")

                            # --- SAFE CLEANUP FIX ---
                            try:
                                time.sleep(1)
                                if os.path.exists(action['local_path']):
                                    os.remove(action['local_path'])
                            except Exception as cleanup_error:
                                print(f"⚠️ Could not delete temp file (locked): {cleanup_error}")
                            # ------------------------

                            del pending_actions[sender]

    except KeyError:
        pass
    return "OK"


# --- VERIFY WEBHOOK ---
@app.get("/webhook")
async def verify(request: Request):
    if request.query_params.get("hub.verify_token") == VERIFY_TOKEN:
        return int(request.query_params.get("hub.challenge"))
    return Response("Forbidden", 403)