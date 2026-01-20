from supabase_client import supabase
from google_auth import get_drive_service


# --- HELPER: ROBUST FOLDER DETECTION ---
def find_folder_match(user, query):
    folder_map = user.get('folder_map', {})
    query = query.lower().strip()

    # We explicitly define the logic here to match "Subjects"
    for subject, data in folder_map.items():
        subject_clean = subject.lower()

        # LOGIC A: User typed a shortcut? (e.g. "Full Stack" inside "Full Stack Web Dev")
        match_a = query in subject_clean

        # LOGIC B: User typed a long sentence? (e.g. "Full Stack Web Dev" inside "Give Full Stack Web Dev please")
        match_b = subject_clean in query

        if match_a or match_b:
            return {
                "type": "SUBJECT",
                "name": subject,
                "id": data['id'],
                "children": data.get('units', {})
            }

    # Repeat the same logic for Units
    for subject, data in folder_map.items():
        units = data.get('units', {})
        for unit_name, unit_id in units.items():
            unit_clean = unit_name.lower()

            # Check A & B for units too
            if (query in unit_clean) or (unit_clean in query):
                return {
                    "type": "UNIT",
                    "name": unit_name,
                    "parent": subject,
                    "id": unit_id,
                    "children": None
                }
    return None


# --- HELPER: SMART SEARCH SUPABASE ---
def search_files_in_db(user_id, query):
    # 1. Fetch ALL user's files
    response = supabase.table('files').select("*").eq("user_id", user_id).execute()
    all_files = response.data

    if not all_files: return []

    # 2. PREPARE THE QUERY
    # Convert to lowercase
    raw_query = query.lower()

    # Define "Stop Words" (Filler words to ignore)
    stop_words = ["find", "search", "get", "give", "show", "me", "my", "the", "a", "an", "file", "document",
                  "screenshot"]

    # Split sentence into words and remove stop words
    # Example: "Give my microsoft screenshot" -> ["give", "my", "microsoft", "screenshot"] -> ["microsoft"]
    query_words = [word for word in raw_query.split() if word not in stop_words]

    # If the user ONLY typed stop words (e.g. "Get screenshot"), keep the original words to avoid empty search
    if not query_words:
        query_words = raw_query.split()

    matches = []

    # 3. SCORE-BASED MATCHING
    for file in all_files:
        score = 0

        # Prepare File Data for searching
        file_name = file['file_name'].lower()
        subject = (file.get('subject') or "").lower()
        # Join all tags into one long string for easy searching
        tags_text = " ".join([t.lower() for t in (file.get('tags') or [])])

        # Check every word in the user's query
        for word in query_words:
            # If word appears in Name, Subject, or Tags -> Add points
            if word in file_name: score += 3  # High priority for filename
            if word in tags_text: score += 2  # Medium priority for tags
            if word in subject:   score += 1  # Low priority for subject

        # If the file has any match (score > 0), add it to results
        if score > 0:
            file['search_score'] = score  # Save score to sort later
            matches.append(file)

    # 4. SORT BY RELEVANCE
    # Files with higher scores (more matching words) appear first
    matches.sort(key=lambda x: x['search_score'], reverse=True)

    return matches

# --- HELPER: GET CLICKABLE DRIVE LINK ---
def get_drive_link(google_token, file_id):
    try:
        service = get_drive_service(google_token)
        file = service.files().get(
            fileId=file_id,
            fields="webViewLink, webContentLink, iconLink"
        ).execute()
        return file.get('webViewLink')
    except Exception as e:
        print(f"❌ Link Fetch Error: {e}")
        return "https://drive.google.com"  # Fallback