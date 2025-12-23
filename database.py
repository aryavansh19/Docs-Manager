import json
import os

DB_FILE = "users.json"

# --- 1. Load the Database ---
def load_db():
    if not os.path.exists(DB_FILE):
        return {}  # Return empty dict if file doesn't exist
    try:
        with open(DB_FILE, "r") as f:
            return json.load(f)
    except json.JSONDecodeError:
        return {}

# --- 2. Save the Database ---
def save_db(data):
    with open(DB_FILE, "w") as f:
        json.dump(data, f, indent=4)

# --- 3. Get User Data ---
def get_user(phone_number):
    db = load_db()
    # If user doesn't exist, create a default "NEW" profile
    if phone_number not in db:
        db[phone_number] = {
            "status": "NEW",            # States: NEW, EDITING_LIST, ACTIVE
            "temp_syllabus_list": [],   # Stores list while editing
            "folder_map": {},           # Stores final Google Drive IDs
            "root_folder_id": None      # Their main "Smart Docs" folder
        }
        save_db(db)
    return db[phone_number]

# --- 4. Update User Data ---
def update_user(phone_number, key, value):
    db = load_db()
    if phone_number in db:
        db[phone_number][key] = value
        save_db(db)