import json
import os
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from database import get_user
from dotenv import load_dotenv

load_dotenv() # Make sure we can read .env

def authenticate_drive(phone_number):
    """
    Authenticates using the token stored in the SQLite database for a specific user.
    """
    print(f"🔐 Authenticating User: {phone_number}")

    # 1. Get User Data
    user = get_user(phone_number)
    token_data = user.get("google_token")

    if not token_data:
        raise ValueError(f"❌ No Google Token found for user {phone_number}. Please login first.")

    # --- THE FIX: Handle String vs Dictionary ---
    # If the database returned a String, convert it to a Dictionary
    if isinstance(token_data, str):
        try:
            token_data = json.loads(token_data)
        except json.JSONDecodeError:
            raise ValueError("❌ Database Error: Stored token is not valid JSON.")
    # ---------------------------------------------

    # 2. Reconstruct Credentials object
    creds = Credentials(
        token=token_data.get("access_token"),
        refresh_token=token_data.get("refresh_token"),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.getenv("GOOGLE_CLIENT_ID"),
        client_secret=os.getenv("GOOGLE_CLIENT_SECRET")
    )

    return build('drive', 'v3', credentials=creds)