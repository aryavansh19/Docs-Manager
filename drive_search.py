from googleapiclient.discovery import build
from google_auth import authenticate_drive


def search_drive_files(folder_id, query_text=None):
    """
    Lists up to 5 files inside a specific folder.
    """
    service = authenticate_drive()

    # Base query: "Is inside this folder" AND "Not a trash file"
    query = f"'{folder_id}' in parents and trashed = false"

    # If user gave a specific keyword (like "notes"), add it
    if query_text:
        query += f" and name contains '{query_text}'"

    results = service.files().list(
        q=query,
        pageSize=5,
        fields="nextPageToken, files(id, name, webViewLink)"
    ).execute()

    files = results.get('files', [])
    return files