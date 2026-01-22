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

    print(structure_for_ai)
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

    print(response.text)
    try:
        text = response.text.replace("```json", "").replace("```", "").strip()
        return json.loads(text)
    except:
        return {"subject": "Imported Documents", "unit": None, "tags": [], "filename": "Scanned_Doc"}


# --- HELPER 3: UPLOAD TO DRIVE & DB (TRUTHFUL VERSION) ---
def upload_and_index(user_id, google_token, file_obj, mime_type, original_filename, analysis, folder_map, root_id):
    # 1. Parse Gemini Analysis
    subject = analysis.get('subject', 'Imported Documents')
    unit_name = analysis.get('unit')

    target_folder_id = None
    final_folder_name = subject  # Default to what AI said

    # 2. ROUTING LOGIC
    subject_data = folder_map.get(subject)

    if subject_data:
        # Case A: Subject Exists
        if unit_name and 'units' in subject_data:
            unit_id = subject_data['units'].get(unit_name)
            if unit_id:
                target_folder_id = unit_id
                final_folder_name = f"{subject}/{unit_name}"
            else:
                target_folder_id = subject_data['id']
                final_folder_name = subject
        else:
            target_folder_id = subject_data['id']
            final_folder_name = subject
    else:
        # 🟢 Case B: Subject NOT Found (The Fix)
        # If AI invented a folder like "Business Card", we force it to Unsorted
        target_folder_id = root_id
        subject = "Unsorted"
        final_folder_name = "Unsorted"  # <--- This ensures the user is told the truth

    # 3. SMART RENAMING
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
    # Construct Tags
    base_tags = analysis.get('tags', [])
    structural_tags = [subject]
    if unit_name: structural_tags.append(unit_name)
    final_tags = list(set(base_tags + structural_tags))

    supabase.table('files').insert({
        "user_id": user_id,
        "file_name": final_filename,
        "drive_file_id": drive_file_id,
        "folder_id": target_folder_id,
        "subject": subject,  # Stores "Unsorted" correctly
        "tags": final_tags
    }).execute()

    return final_folder_name  # Returns "Unsorted" so the bot says "Saved in Unsorted"