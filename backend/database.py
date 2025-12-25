import sqlite3
import json
import os

DB_NAME = "bot_memory.db"


def init_db():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()

    # 1. Create Table (Standard)
    c.execute('''
              CREATE TABLE IF NOT EXISTS users
              (
                  phone
                  TEXT
                  PRIMARY
                  KEY,
                  email
                  TEXT,
                  name
                  TEXT,
                  picture
                  TEXT,
                  status
                  TEXT
                  DEFAULT
                  'NEW',
                  google_token
                  TEXT,
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
                  created_at
                  TIMESTAMP
                  DEFAULT
                  CURRENT_TIMESTAMP
              )
              ''')

    # 2. AUTOMATIC REPAIR: Add missing columns if they don't exist
    c.execute("PRAGMA table_info(users)")
    columns = [info[1] for info in c.fetchall()]

    # ADD EMAIL COLUMN (Crucial for Login Flow)
    if "email" not in columns:
        print("🔧 Database: adding missing column 'email'...")
        c.execute("ALTER TABLE users ADD COLUMN email TEXT")

    if "root_folder_id" not in columns:
        c.execute("ALTER TABLE users ADD COLUMN root_folder_id TEXT")

    if "name" not in columns:
        c.execute("ALTER TABLE users ADD COLUMN name TEXT")

    if "picture" not in columns:
        c.execute("ALTER TABLE users ADD COLUMN picture TEXT")

    conn.commit()
    conn.close()


def get_user(phone):
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    try:
        c.execute("SELECT * FROM users WHERE phone = ?", (phone,))
        row = c.fetchone()
        if row: return dict(row)
    except:
        return None
    finally:
        conn.close()
    return None


# --- NEW FUNCTION FOR LOGIN FLOW ---
def get_user_by_email(email):
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    try:
        # Search for user where email matches
        c.execute("SELECT * FROM users WHERE email = ?", (email,))
        row = c.fetchone()
        if row: return dict(row)
    except:
        return None
    finally:
        conn.close()
    return None


def update_user(phone, key, value):
    # Ensure user exists before updating
    if not get_user(phone):
        conn = sqlite3.connect(DB_NAME)
        c = conn.cursor()
        c.execute("INSERT INTO users (phone) VALUES (?)", (phone,))
        conn.commit()
        conn.close()

    if isinstance(value, (dict, list)):
        value = json.dumps(value)

    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    try:
        query = f"UPDATE users SET {key} = ? WHERE phone = ?"
        c.execute(query, (value, phone))
        conn.commit()
    except Exception as e:
        print(f"❌ DB Error: {e}")
    finally:
        conn.close()

init_db()