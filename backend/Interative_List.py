import os
import requests
from flask.cli import load_dotenv

load_dotenv()

META_TOKEN = os.getenv("META_TOKEN")
PHONE_NUMBER_ID = os.getenv("PHONE_NUMBER_ID")
VERIFY_TOKEN = os.getenv("VERIFY_TOKEN")


# --- HELPER: SEND INTERACTIVE LIST (MENU) ---
def send_interactive_list(to_number, body_text, button_text, items):
    """
    items = [{'id': 'file_id_123', 'title': 'Unit 1.pdf', 'description': 'Physics'}]
    Limits: Max 10 items allowed by WhatsApp.
    """
    url = f"https://graph.facebook.com/v17.0/{PHONE_NUMBER_ID}/messages"
    headers = {
        "Authorization": f"Bearer {META_TOKEN}",
        "Content-Type": "application/json"
    }

    # Slice to max 10 items (Meta limit)
    safe_items = items[:10]

    rows = []
    for item in safe_items:
        rows.append({
            "id": item['id'],  # We will put the Google Drive ID here
            "title": item['title'][:24],  # Max 24 chars for title
            "description": item['description'][:72]  # Max 72 chars for desc
        })

    data = {
        "messaging_product": "whatsapp",
        "to": to_number,
        "type": "interactive",
        "interactive": {
            "type": "list",
            "body": {"text": body_text},
            "action": {
                "button": button_text,
                "sections": [
                    {
                        "title": "Select a File",
                        "rows": rows
                    }
                ]
            }
        }
    }

    r = requests.post(url, headers=headers, json=data)
    return r.json()