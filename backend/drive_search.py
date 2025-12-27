from google_auth import authenticate_drive


def search_drive_files(phone_number, query_text, folder_id=None):
    """
    Searches for files matching ALL keywords in the query, regardless of order.
    Example: "Adhar Saini" -> Finds "Important Documents_Aadhar Card_Aryavansh Saini.pdf"
    """
    try:
        # 1. Authenticate
        service = authenticate_drive(phone_number)

        # 2. Smart Query Cleaning
        # Remove "Give", "Get" etc.
        stopwords = ["give", "get", "find", "search", "show", "me", "my", "the", "notes", "file"]
        clean_text = query_text.lower()
        for word in stopwords:
            clean_text = clean_text.replace(f"{word} ", " ")  # Replace with space

        # 3. Split into Keywords (The Fix)
        # "Adhar Saini" -> ["adhar", "saini"]
        keywords = clean_text.split()

        if not keywords:
            print("⚠️ Query is empty after cleaning.")
            return []

        # 4. Build Dynamic Query
        # We want: (name contains 'word1') AND (name contains 'word2') ...
        query_parts = ["trashed = false"]

        for word in keywords:
            # Sanitize input
            safe_word = word.replace("'", "").replace('"', "")
            query_parts.append(f"name contains '{safe_word}'")

        # Combine with 'and'
        q_base = " and ".join(query_parts)

        # 5. Get Folder Name (Log only)
        folder_name_log = "Global"
        if folder_id:
            try:
                f_meta = service.files().get(fileId=folder_id, fields="name").execute()
                folder_name_log = f_meta.get('name', folder_id)
            except:
                pass

        print(f"🔎 SEARCHING: {keywords} (Location: {folder_name_log})")
        print(f"   Query: {q_base}")

        # 6. ATTEMPT 1: Specific Folder
        if folder_id:
            q_specific = q_base + f" and '{folder_id}' in parents"

            results = service.files().list(
                q=q_specific,
                pageSize=5,
                fields="files(id, name, webViewLink, mimeType)"
            ).execute()

            files = results.get('files', [])
            if files:
                print(f"   ✅ Found {len(files)} matches in '{folder_name_log}'.")
                return files

        # 7. ATTEMPT 2: Global Search (Fallback)
        print("   👉 Global Fallback Search...")
        results_global = service.files().list(
            q=q_base,
            pageSize=10,
            fields="files(id, name, webViewLink, mimeType)"
        ).execute()

        files = results_global.get('files', [])
        print(f"   ✅ Found {len(files)} matches globally.")

        return files

    except Exception as e:
        print(f"❌ SEARCH ERROR: {e}")
        return []