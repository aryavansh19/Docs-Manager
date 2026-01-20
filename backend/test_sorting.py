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


# --- HELPER 2: ANALYZE WITH GEMINI (DEEP SEARCH) ---
def analyze_document(file_bytes, mime_type, full_folder_map):
    model = genai.GenerativeModel('gemini-2.5-flash')

    # 1. Simplify Map for Gemini (Remove IDs to save tokens/confusion)
    # We convert: { "Physics": { "id": "...", "units": { "Optics": "..." } } }
    # To: { "Physics": ["Optics", "Mechanics"], "Chemistry": ["Organic"] }
    structure_for_ai = {}
    for subject, data in full_folder_map.items():
        units = list(data.get('units', {}).keys())
        structure_for_ai[subject] = units

    # 2. The Deep-Filing Prompt
    prompt = f"""
    Analyze this document. Your goal is to file it into the specific 'Unit' folder if possible.

    Here is the User's Folder Structure:
    {json.dumps(structure_for_ai, indent=2)}

    Instructions:
    1. Identify the best 'Subject'.
    2. Look inside that Subject. Does the content match one of the 'Units'?
       - If YES: Return that Unit name exactly.
       - If NO (or if generic): Return null for Unit.
    3. Generate a clean 'filename'.

    Return JSON:
    {{
        "subject": "Full Stack web Development",
        "unit": "React JS", 
        "tags": ["components", "hooks", "props"],
        "filename": "React_Hooks_Summary"
    }}
    """

    response = model.generate_content([
        {"mime_type": mime_type, "data": file_bytes.getvalue()},
        prompt
    ])

    try:
        text = response.text.replace("```json", "").replace("```", "").strip()
        return json.loads(text)
    except:
        return {"subject": "Imported Documents", "unit": None, "tags": [], "filename": "Scanned_Doc"}


# --- HELPER 3: UPLOAD TO DRIVE & DB (DEEP ROUTING) ---
def upload_and_index(user_id, google_token, file_obj, mime_type, original_filename, analysis, folder_map, root_id):
    # 1. Parse Gemini Analysis
    subject = analysis.get('subject', 'Imported Documents')
    unit_name = analysis.get('unit')  # This might be None

    target_folder_id = None
    final_folder_name = subject  # For logging

    # 2. ROUTING LOGIC (The Deep Dive)
    subject_data = folder_map.get(subject)

    if subject_data:
        # Step A: Check if Gemini found a valid Unit
        if unit_name and 'units' in subject_data:
            # Try to find the specific Unit's ID
            unit_id = subject_data['units'].get(unit_name)
            if unit_id:
                target_folder_id = unit_id
                final_folder_name = f"{subject}/{unit_name}"
            else:
                # Fallback: Unit name didn't match perfectly, go to Subject
                target_folder_id = subject_data['id']
        else:
            # Step B: No unit found, go to Subject Folder
            target_folder_id = subject_data['id']
    else:
        # Step C: Subject not found, go to Root
        target_folder_id = root_id
        subject = "Unsorted"

    # 3. SMART RENAMING (Keep your existing logic)
    ai_name = analysis.get('filename')
    _, ext = os.path.splitext(original_filename)
    if not ext: ext = ".pdf" if "pdf" in mime_type else ".jpg"

    if ai_name:
        clean_name = ai_name.replace(" ", "_").replace("/", "-")
        final_filename = f"{clean_name}{ext}"
    else:
        final_filename = original_filename

    # 4. UPLOAD TO DRIVE
    service = get_drive_service(google_token)
    file_metadata = {
        'name': final_filename,
        'parents': [target_folder_id]
    }

    media = MediaIoBaseUpload(file_obj, mimetype=mime_type, resumable=True)
    drive_file = service.files().create(body=file_metadata, media_body=media, fields='id').execute()
    drive_file_id = drive_file.get('id')

    # 5. SAVE TO SUPABASE
    base_tags = analysis.get('tags', [])

    # Force add hierarchical tags so "Full Stack" search finds this file
    structural_tags = [subject]
    if unit_name:
        structural_tags.append(unit_name)

    # Combine and remove duplicates
    final_tags = list(set(base_tags + structural_tags))

    supabase.table('files').insert({
        "user_id": user_id,
        "file_name": final_filename,
        "drive_file_id": drive_file_id,
        "folder_id": target_folder_id,
        "subject": subject,
        "tags": final_tags  # <--- UPDATED THIS LINE
    }).execute()

    return final_folder_name