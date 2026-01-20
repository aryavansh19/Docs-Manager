import google.generativeai as genai
import requests
from fastapi import Form, HTTPException
from googleapiclient.http import MediaIoBaseUpload
import io
import os
import json
from supabase_client import supabase
from google_auth import get_drive_service


# Configure Gemini
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))


# --- HELPER 1: DOWNLOAD FILE FROM TWILIO ---
def download_file(url):
    # Twilio URLs sometimes require auth, but standard media URLs usually don't
    # If using WhatsApp Business API directly, headers might be needed.
    r = requests.get(url)
    return io.BytesIO(r.content), r.headers['Content-Type']


# --- HELPER 2: ANALYZE WITH GEMINI ---
def analyze_document(file_bytes, mime_type, subject_list):
    model = genai.GenerativeModel('gemini-2.5-flash')

    # We give Gemini the list of subjects so it picks the best one
    prompt = f"""
    Analyze this document/image. 
    1. Identify the 'Subject' from this list: {subject_list}. If unsure, use "Imported Documents".
    2. Extract 5-10 keywords (tags) describing the content (e.g., 'deadlock', 'aadhar', 'formula').

    Return ONLY JSON format:
    {{
        "subject": "Physics",
        "tags": ["keyword1", "keyword2"]
    }}
    """

    # Gemini Flash handles images/PDFs natively
    response = model.generate_content([
        {"mime_type": mime_type, "data": file_bytes.getvalue()},
        prompt
    ])

    try:
        # Clean up JSON (sometimes Gemini adds ```json ... ```)
        text = response.text.replace("```json", "").replace("```", "").strip()
        return json.loads(text)
    except:
        return {"subject": "Imported Documents", "tags": []}


# --- HELPER 3: UPLOAD TO DRIVE & DB ---
def upload_and_index(user_id, google_token, file_obj, mime_type, filename, analysis, folder_map, root_id):
    # 1. Determine Folder ID
    subject = analysis.get('subject', 'Imported Documents')

    # Look for the subject in the user's folder map
    # Structure: folder_map = { "Physics": { "id": "...", "units": ... } }
    target_folder_data = folder_map.get(subject)

    if target_folder_data:
        target_folder_id = target_folder_data['id']
    else:
        # Fallback to Root if subject not found
        target_folder_id = root_id
        subject = "Unsorted"

    # 2. Upload to Google Drive
    service = get_drive_service(google_token)

    file_metadata = {
        'name': filename,
        'parents': [target_folder_id]
    }

    media = MediaIoBaseUpload(file_obj, mimetype=mime_type, resumable=True)
    drive_file = service.files().create(body=file_metadata, media_body=media, fields='id').execute()
    drive_file_id = drive_file.get('id')

    # 3. Save to Supabase (The "Smart Index")
    supabase.table('files').insert({
        "user_id": user_id,
        "file_name": filename,
        "drive_file_id": drive_file_id,
        "folder_id": target_folder_id,
        "subject": subject,
        "tags": analysis.get('tags', [])
    }).execute()

    return subject