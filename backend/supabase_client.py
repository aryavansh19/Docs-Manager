import os
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

url: str = os.getenv("SUPABASE_URL")
key: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    raise ValueError("❌ Error: Missing SUPABASE_URL or SUPABASE_KEY in .env file")

# Initialize the client
supabase: Client = create_client(url, key)