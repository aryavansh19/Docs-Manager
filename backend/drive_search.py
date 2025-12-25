from google_auth import authenticate_drive


# --- UPDATE: Add phone_number argument here ---
def search_drive_files(folder_id, phone_number, query_text=None):
    """
    Lists up to 5 files inside a specific folder.
    """
    # --- UPDATE: Pass phone_number to auth ---
    service = authenticate_drive(phone_number)

    # Base query: "Is inside this folder" AND "Not a trash file"
    query = f"'{folder_id}' in parents and trashed = false"

    if query_text:
        query += f" and name contains '{query_text}'"

    results = service.files().list(
        q=query,
        pageSize=5,
        fields="nextPageToken, files(id, name, webViewLink)"
    ).execute()

    files = results.get('files', [])
    return files