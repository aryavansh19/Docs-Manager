import os
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build


# ---------------------------------------------------------
# 🔑 AUTHENTICATION HELPER (Supabase Compatible)
# ---------------------------------------------------------
def get_drive_service(refresh_token):
    """
    Builds the Google Drive Service using the Refresh Token.
    We don't need to look up the user in a DB; we already have the token.
    """

    # Ensure these are in your backend .env file!
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")

    if not client_id or not client_secret:
        raise Exception("❌ Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in environment variables.")

    # Reconstruct credentials object
    creds = Credentials(
        None,  # We don't have an access token yet, we let it refresh
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=client_id,
        client_secret=client_secret
    )

    return build('drive', 'v3', credentials=creds)


# ---------------------------------------------------------
# 📂 FOLDER CREATION LOGIC
# ---------------------------------------------------------
def create_folder(service, name, parent_id=None):
    """Creates a single folder on Drive and returns its ID."""
    file_metadata = {
        'name': name,
        'mimeType': 'application/vnd.google-apps.folder'
    }
    if parent_id:
        file_metadata['parents'] = [parent_id]

    try:
        file = service.files().create(body=file_metadata, fields='id').execute()
        print(f"✅ Created Folder: {name} ({file.get('id')})")
        return file.get('id')
    except Exception as e:
        print(f"❌ Error creating folder '{name}': {e}")
        return None


def build_drive_structure(refresh_token, syllabus_list, folder_name_suffix="User"):
    """
    Creates the Root folder and all subfolders.
    Args:
        refresh_token: The token string from Supabase.
        syllabus_list: Dict like {'Physics': ['Unit 1', 'Unit 2']}
        folder_name_suffix: Usually the phone number, to name the root folder.
    """

    # 1. Authenticate directly
    service = get_drive_service(refresh_token)

    # 2. Create Root Folder
    root_name = f"SmartDoc AI - {folder_name_suffix}"
    root_id = create_folder(service, root_name)

    folder_map = {}

    # 3. Create Subject & Unit Folders
    for subject, units in syllabus_list.items():
        subj_id = create_folder(service, subject, parent_id=root_id)

        if not subj_id: continue  # Skip if failed

        folder_map[subject] = {
            "id": subj_id,
            "units": {}
        }

        # Create Unit folders inside Subject
        for unit in units:
            unit_id = create_folder(service, unit, parent_id=subj_id)
            if unit_id:
                folder_map[subject]["units"][unit] = unit_id

    return root_id, folder_map


# Ensure you have these imports at the top of folder_creater.py
# from folder_creater import get_drive_service, create_folder (if in same file, no import needed)

def append_folders_to_drive(refresh_token, root_folder_id, new_structure):
    """
    Creates ONLY the folders in 'new_structure' inside the EXISTING 'root_folder_id'.
    Returns a dictionary of the newly created folders.
    """

    # 1. AUTHENTICATE (Use the token directly!)
    # ❌ OLD: service = authenticate_drive(phone)
    # ✅ NEW:
    service = get_drive_service(refresh_token)

    created_map = {}
    print(f"📂 Appending to Root ID: {root_folder_id}")

    for subject_name, units in new_structure.items():
        # 2. Create Subject Folder using our helper (safer)
        subject_id = create_folder(service, subject_name, parent_id=root_folder_id)

        if not subject_id:
            print(f"❌ Failed to create subject: {subject_name}")
            continue

        # 3. Add to map
        created_map[subject_name] = {
            "id": subject_id,
            "units": {}
        }

        # 4. Create Unit Subfolders
        for unit_name in units:
            unit_id = create_folder(service, unit_name, parent_id=subject_id)

            if unit_id:
                created_map[subject_name]["units"][unit_name] = unit_id

    return created_map