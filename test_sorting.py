import json
import os
import google.generativeai as genai
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from googleapiclient.http import MediaFileUpload

# --- CONFIGURATION ---
# 1. Get your API Key from: https://aistudio.google.com/app/apikey
GEMINI_API_KEY = "AIzaSyD1mByWj8Su82wAX4upMiG0fWN-qElhX70"

# --- SETUP ---
genai.configure(api_key=GEMINI_API_KEY)


def authenticate_drive():
    """Logs in using your existing credentials."""
    creds = Credentials.from_authorized_user_file('token.json')
    return build('drive', 'v3', credentials=creds)


def load_folder_map():
    with open('folder_map.json', 'r') as f:
        return json.load(f)


def ask_gemini_to_sort(file_path, folder_map):
    print("🤖 AI is analyzing the file...")
    model = genai.GenerativeModel('gemini-3-flash-preview')
    myfile = genai.upload_file(file_path)

    # We simplify the map for Gemini (sending IDs confuses it, we just want names)
    syllabus_lite = {subj: list(data['units'].keys()) for subj, data in folder_map.items()}

    prompt = f"""
    You are a Document Sorter.
    Analyze the attached file.
    Match it to one of these Subjects and Units:
    {json.dumps(syllabus_lite)}

    Return STRICT JSON:
    {{
      "subject": "Exact Subject Name",
      "unit": "Exact Unit Name",
      "suggested_filename": "descriptive_name_with_underscores.pdf"
    }}
    """

    result = model.generate_content(
        [prompt, myfile],
        generation_config={"response_mime_type": "application/json"}
    )
    return json.loads(result.text)


def upload_to_drive(service, file_path, filename, folder_id):
    print(f"🚀 Uploading '{filename}' to Drive...")
    file_metadata = {'name': filename, 'parents': [folder_id]}
    media = MediaFileUpload(file_path, mimetype='application/pdf')  # or image/jpeg
    file = service.files().create(body=file_metadata, media_body=media, fields='id').execute()
    print(f"✅ Success! File ID: {file.get('id')}")


# --- MAIN EXECUTION ---
if __name__ == "__main__":
    # 1. Load Data
    drive_service = authenticate_drive()
    my_folders = load_folder_map()

    # 2. PICK A TEST FILE
    # (Put a dummy PDF or Image in your project folder and type its name here)
    test_file = "test_notes.pdf"

    if not os.path.exists(test_file):
        print(f"❌ Error: Please put a file named '{test_file}' in your folder to test.")
    else:
        # 3. Ask AI
        decision = ask_gemini_to_sort(test_file, my_folders)
        print(f"🧠 AI Decision: {decision['subject']} -> {decision['unit']}")

        # 4. Find the Folder ID
        subj = decision['subject']
        unit = decision['unit']

        # Safe lookup
        if subj in my_folders and unit in my_folders[subj]['units']:
            target_folder_id = my_folders[subj]['units'][unit]

            # 5. Upload
            upload_to_drive(drive_service, test_file, decision['suggested_filename'], target_folder_id)
        else:
            print("❌ AI picked a subject/unit that doesn't exist in our map!")