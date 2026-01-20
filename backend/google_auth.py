from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
import os


def get_drive_service(refresh_token):
    """
    Reconstructs the Google Drive Service object using the Refresh Token.
    This allows us to act on behalf of the user without them logging in again.
    """

    # 1. Get App Credentials from Environment
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")

    if not client_id or not client_secret:
        raise Exception("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env")

    # 2. Build Credentials Object
    # We pass 'None' for the access token because the refresh token will fetch a new one automatically.
    creds = Credentials(
        None,  # Access token (will be refreshed)
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=client_id,
        client_secret=client_secret
    )

    # 3. Build and Return Service
    service = build('drive', 'v3', credentials=creds)
    return service