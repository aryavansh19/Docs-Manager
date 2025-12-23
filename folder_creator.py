# Import the function from our new file
from google_auth import authenticate_drive


def create_folder(service, name, parent_id=None):
    """Creates a folder and returns its ID."""
    file_metadata = {
        'name': name,
        'mimeType': 'application/vnd.google-apps.folder'
    }
    if parent_id:
        file_metadata['parents'] = [parent_id]

    file = service.files().create(body=file_metadata, fields='id').execute()
    print(f"✅ Created Folder: {name} ({file.get('id')})")
    return file.get('id')


def build_drive_structure(user_phone, syllabus_list):
    # 1. Authenticate (Pass the user_phone so we get the correct token!)
    service = authenticate_drive(user_phone)

    # 2. Create Root Folder
    root_name = f"Smart Docs - {user_phone}"
    root_id = create_folder(service, root_name)

    folder_map = {}

    # 3. Create Subject & Unit Folders
    for subject, units in syllabus_list.items():
        subj_id = create_folder(service, subject, parent_id=root_id)

        folder_map[subject] = {
            "id": subj_id,
            "units": {}
        }

        for unit in units:
            unit_id = create_folder(service, unit, parent_id=subj_id)
            folder_map[subject]["units"][unit] = unit_id

    return root_id, folder_map