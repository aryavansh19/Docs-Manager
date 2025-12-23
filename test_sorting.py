import json
import os
import google.generativeai as genai
from googleapiclient.http import MediaFileUpload
from dotenv import load_dotenv

# 1. Import the shared Auth logic (Do not define it again below!)
from google_auth import authenticate_drive

# 2. Load Environment Variables
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise ValueError("❌ Missing GEMINI_API_KEY in .env file")

genai.configure(api_key=GEMINI_API_KEY)

# Add this import
import json

def parse_search_intent(user_text, folder_map):
    """
    Asks Gemini: 'User wants X. Which folder ID from this list matches?'
    """
    model = genai.GenerativeModel('gemini-3-flash-preview')

    # Simplify map for Gemini (Subject names only)
    map_summary = list(folder_map.keys())

    prompt = f"""
    You are a Search Assistant.
    User Query: "{user_text}"
    Available Folders: {json.dumps(map_summary)}

    1. Did the user ask to FIND/GET/SHOW a file? (yes/no)
    2. Which 'Subject' from the list matches best? (If 'Aadhar', maybe 'Important Documents')

    Return JSON:
    {{
        "is_search": true,
        "subject": "Exact Subject Name",
        "keyword": "optional extra keyword like 'unit 1'"
    }}
    """

    try:
        result = model.generate_content(prompt)
        text = result.text.replace("```json", "").replace("```", "").strip()
        return json.loads(text)
    except:
        return {"is_search": False}


# --- FUNCTION 1: Ask Gemini (The Brain) ---
def ask_gemini_to_sort(file_path, folder_map):
    print("🤖 AI is analyzing the file...")

    # Use the standard Flash model
    model = genai.GenerativeModel('gemini-3-flash-preview')
    myfile = genai.upload_file(file_path)

    # Simplify map for AI
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
      "suggested_filename": "Subject_Unit_Topic.pdf"
    }}
    """

    result = model.generate_content(
        [prompt, myfile],
        generation_config={"response_mime_type": "application/json"}
    )
    return json.loads(result.text)


# --- FUNCTION 2: Upload to Drive (The Action) ---
def upload_to_drive(service, file_path, filename, folder_id):
    print(f"🚀 Uploading '{filename}' to Drive...")

    file_metadata = {'name': filename, 'parents': [folder_id]}

    # Auto-detect mime type (simple check)
    mime_type = 'application/pdf'
    if file_path.lower().endswith(('.jpg', '.jpeg', '.png')):
        mime_type = 'image/jpeg'

    media = MediaFileUpload(file_path, mimetype=mime_type)

    file = service.files().create(body=file_metadata, media_body=media, fields='id').execute()
    print(f"✅ Success! File ID: {file.get('id')}")


# --- FUNCTION 3: Local Testing Helper (Optional) ---
def load_folder_map():
    # Only used for local testing, not by the bot
    if os.path.exists('folder_map.json'):
        with open('folder_map.json', 'r') as f:
            return json.load(f)
    return {}


# --- MAIN EXECUTION (For Manual Testing Only) ---
if __name__ == "__main__":
    # This block only runs if you type 'python test_sorting.py' manually
    print("🧪 Starting Manual Test...")

    drive_service = authenticate_drive()
    my_folders = load_folder_map()

    test_file = "test_notes.pdf"  # Make sure this file exists!

    if not os.path.exists(test_file):
        print(f"❌ Error: Create a dummy file named '{test_file}' to test.")
    elif not my_folders:
        print("❌ Error: No folder_map.json found. Run the bot setup first.")
    else:
        # Test the AI
        decision = ask_gemini_to_sort(test_file, my_folders)
        print(f"🧠 AI Decision: {decision}")

        # Test Upload
        subj = decision['subject']
        unit = decision['unit']

        if subj in my_folders and unit in my_folders[subj]['units']:
            target_id = my_folders[subj]['units'][unit]
            upload_to_drive(drive_service, test_file, decision['suggested_filename'], target_id)
        else:
            print("❌ AI picked a folder that doesn't exist.")