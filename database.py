import sqlite3
import json

DB_FILE = "bot_memory.db"


def get_db_connection():
    """Connects to the SQLite database."""
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row  # Allows accessing columns by name
    return conn


def init_db():
    """Creates the table if it doesn't exist."""
    conn = get_db_connection()
    c = conn.cursor()

    # We create a table with columns for all our data
    c.execute('''
              CREATE TABLE IF NOT EXISTS users
              (
                  phone_number
                  TEXT
                  PRIMARY
                  KEY,
                  status
                  TEXT
                  DEFAULT
                  'NEW',
                  temp_syllabus_list
                  TEXT
                  DEFAULT
                  '{}',
                  folder_map
                  TEXT
                  DEFAULT
                  '{}',
                  root_folder_id
                  TEXT,
                  google_token
                  TEXT
              )
              ''')
    conn.commit()
    conn.close()


# --- 1. Get User Data ---
def get_user(phone_number):
    conn = get_db_connection()
    user = conn.execute('SELECT * FROM users WHERE phone_number = ?', (phone_number,)).fetchone()
    conn.close()

    # If user doesn't exist, create them
    if user is None:
        conn = get_db_connection()
        conn.execute('INSERT INTO users (phone_number) VALUES (?)', (phone_number,))
        conn.commit()
        conn.close()
        # Return a default dict for a new user
        return {
            "phone_number": phone_number,
            "status": "NEW",
            "temp_syllabus_list": {},
            "folder_map": {},
            "root_folder_id": None
        }

    # Convert the Row object to a standard Python Dictionary
    user_dict = dict(user)

    # JSON strings in DB must be converted back to Python Lists/Dicts
    try:
        user_dict["temp_syllabus_list"] = json.loads(user_dict["temp_syllabus_list"])
    except:
        user_dict["temp_syllabus_list"] = {}

    try:
        user_dict["folder_map"] = json.loads(user_dict["folder_map"])
    except:
        user_dict["folder_map"] = {}

    return user_dict


# --- 2. Update User Data ---
def update_user(phone_number, key, value):
    conn = get_db_connection()

    # If we are saving a List or Dict, convert to JSON string first
    if isinstance(value, (dict, list)):
        value = json.dumps(value)

    # SQL Update Query
    # WARNING: This is safe because 'key' comes from our code, not user input.
    query = f'UPDATE users SET {key} = ? WHERE phone_number = ?'

    conn.execute(query, (value, phone_number))
    conn.commit()
    conn.close()


# Run initialization immediately when imported
init_db()