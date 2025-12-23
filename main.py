import os
import time
import requests
import json
from fastapi import FastAPI, Request, BackgroundTasks, Response
from dotenv import load_dotenv

# Import your existing logic
from test_sorting import load_folder_map, ask_gemini_to_sort, upload_to_drive, authenticate_drive

load_dotenv()

app = FastAPI()

# --- CONFIGURATION ---
WHATSAPP_TOKEN = os.getenv("WHATSAPP_TOKEN")
PHONE_NUMBER_ID = os.getenv("PHONE_NUMBER_ID")
VERIFY_TOKEN = os.getenv("VERIFY_TOKEN")

if not WHATSAPP_TOKEN or not PHONE_NUMBER_ID:
    raise ValueError("❌ Missing Keys! Check your .env file.")

# --- MEMORY ---
pending_actions = {}


# --- HELPER 1: Send Standard Text ---
def send_whatsapp_message(to_number, body_text):
    url = f"https://graph.facebook.com/v17.0/{PHONE_NUMBER_ID}/messages"
    headers = {
        "Authorization": f"Bearer {WHATSAPP_TOKEN}",
        "Content-Type": "application/json"
    }
    data = {
        "messaging_product": "whatsapp",
        "to": to_number,
        "type": "text",
        "text": {"body": body_text}
    }
    requests.post(url, headers=headers, json=data)


# --- HELPER 2: Send BUTTONS (New!) ---
def send_whatsapp_buttons(to_number, body_text, buttons):
    """
    buttons = [{"id": "yes", "title": "Save"}, {"id": "no", "title": "Discard"}]
    """
    url = f"https://graph.facebook.com/v17.0/{PHONE_NUMBER_ID}/messages"
    headers = {
        "Authorization": f"Bearer {WHATSAPP_TOKEN}",
        "Content-Type": "application/json"
    }

    # Construct the Button JSON structure
    button_actions = []
    for btn in buttons:
        button_actions.append({
            "type": "reply",
            "reply": {
                "id": btn["id"],
                "title": btn["title"]
            }
        })

    data = {
        "messaging_product": "whatsapp",
        "to": to_number,
        "type": "interactive",
        "interactive": {
            "type": "button",
            "body": {
                "text": body_text
            },
            "action": {
                "buttons": button_actions
            }
        }
    }
    r = requests.post(url, headers=headers, json=data)
    if r.status_code != 200:
        print(f"❌ Error sending buttons: {r.text}")


# --- HELPER 3: Download File ---
def download_whatsapp_media(media_id, filename):
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
    except Exception as e:
        print(f"❌ Download Failed: {e}")
    return False


# --- BACKGROUND BRAIN ---
def process_file_background(media_id, sender, temp_filename):
    print(f"🔄 Processing file {media_id} from {sender}...")

    if download_whatsapp_media(media_id, temp_filename):
        try:
            # 1. Ask Gemini
            my_folders = load_folder_map()
            decision = ask_gemini_to_sort(temp_filename, my_folders)

            subj = decision['subject']
            unit = decision['unit']
            new_name = decision['suggested_filename']

            # 2. Check Map
            if subj in my_folders and unit in my_folders[subj]['units']:
                folder_id = my_folders[subj]['units'][unit]

                # 3. Save State
                pending_actions[sender] = {
                    "local_path": temp_filename,
                    "drive_folder_id": folder_id,
                    "new_name": new_name,
                    "subject": subj
                }

                # 4. SEND BUTTONS
                msg = (
                    f"🧐 *Analysis Complete:*\n"
                    f"📂 Folder: *{subj}*\n"
                    f"📝 Unit: *{unit}*\n"
                    f"📄 Name: _{new_name}_"
                )

                # Define the buttons
                my_buttons = [
                    {"id": "confirm_save", "title": "✅ Save"},
                    {"id": "cancel_discard", "title": "❌ Discard"}
                ]

                send_whatsapp_buttons(sender, msg, my_buttons)

            else:
                send_whatsapp_message(sender,
                                      f"⚠️ AI identified '{subj}', but I couldn't find that folder in your map.")

        except Exception as e:
            print(f"❌ AI Error: {e}")
            send_whatsapp_message(sender, "❌ Error analyzing file.")
    else:
        send_whatsapp_message(sender, "❌ Failed to download file.")


# --- WEBHOOK VERIFICATION ---
@app.get("/webhook")
async def verify_webhook(request: Request):
    mode = request.query_params.get("hub.mode")
    token = request.query_params.get("hub.verify_token")
    challenge = request.query_params.get("hub.challenge")

    if mode == "subscribe" and token == VERIFY_TOKEN:
        return int(challenge)
    return Response(content="Forbidden", status_code=403)


# --- WEBHOOK LISTENER ---
@app.post("/webhook")
async def receive_whatsapp(request: Request, background_tasks: BackgroundTasks):
    data = await request.json()

    try:
        entry = data['entry'][0]
        changes = entry['changes'][0]
        value = changes['value']

        if 'messages' in value:
            message = value['messages'][0]
            sender = message['from']
            msg_type = message['type']

            # --- SCENARIO A: User Sent a FILE ---
            if msg_type in ['image', 'document']:
                media_id = message[msg_type]['id']
                ext = ".jpg" if msg_type == "image" else ".pdf"
                if msg_type == 'document' and "pdf" in message['document'].get('mime_type', ''):
                    ext = ".pdf"

                temp_filename = f"temp_{int(time.time())}{ext}"

                send_whatsapp_message(sender, "🤖 Analyzing... (Wait ~5s)")
                background_tasks.add_task(process_file_background, media_id, sender, temp_filename)

            # --- SCENARIO B: User Clicked a BUTTON ---
            elif msg_type == 'interactive':
                # Extract the Button ID (e.g., "confirm_save")
                btn_id = message['interactive']['button_reply']['id']

                if sender in pending_actions:
                    action = pending_actions[sender]

                    if btn_id == 'confirm_save':
                        send_whatsapp_message(sender, "🚀 Uploading to Drive...")
                        try:
                            drive_service = authenticate_drive()
                            upload_to_drive(drive_service, action['local_path'], action['new_name'],
                                            action['drive_folder_id'])
                            send_whatsapp_message(sender, f"✅ **Success!** Saved to *{action['subject']}*")
                        except Exception as e:
                            send_whatsapp_message(sender, f"❌ Upload Failed: {e}")

                        # Cleanup
                        if os.path.exists(action['local_path']):
                            os.remove(action['local_path'])
                        del pending_actions[sender]

                    elif btn_id == 'cancel_discard':
                        send_whatsapp_message(sender, "🚫 Discarded. File deleted.")
                        if os.path.exists(action['local_path']):
                            os.remove(action['local_path'])
                        del pending_actions[sender]

            # --- SCENARIO C: Fallback for Text (Manual typing) ---
            elif msg_type == 'text':
                text = message['text']['body'].strip().lower()
                # Keep this as a backup in case buttons fail
                if text == '1' or text == 'save':
                    # (You could copy the upload logic here too if you want redundancy)
                    send_whatsapp_message(sender, "Please click the buttons above.")
                else:
                    send_whatsapp_message(sender, "Hi! Send a PDF to start.")

    except KeyError:
        pass

    return "OK"
