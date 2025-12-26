
import google.generativeai as genai
import os
import json
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

def parse_syllabus_with_gemini(file_path):
    """
    Reads a Syllabus PDF/Image and returns a list of Subjects + Units.
    Returns ONLY academic subjects found in the file.
    """
    print(f"📄 Parsing syllabus: {file_path}...")

    # 1. Upload File
    myfile = genai.upload_file(file_path)
    # Note: Ensure the model name is correct. "gemini-1.5-flash" or "gemini-pro" are common.
    # "gemini-2.0-flash" might be experimental/preview.
    model = genai.GenerativeModel("gemini-2.5-flash")

    # 2. The Prompt (Strict JSON output)
    prompt = """
    Analyze this syllabus document. Extract the list of Subjects including Labs and their Units/Modules.

    Return ONLY a JSON object with this exact structure:
    {
        "subjects": {
            "Subject Name 1": ["Unit 1 Name", "Unit 2 Name"],
            "Subject Name 2": ["Unit 1 Name", "Unit 2 Name"]
        }
    }

    Rules:
    - Simplify Subject Names (e.g., "Database Management Systems" -> "DBMS").
    - If units don't have names, just use ["Unit 1", "Unit 2", ...].
    """

    # 3. Generate
    result = model.generate_content([myfile, prompt])

    try:
        # Clean up code blocks if Gemini adds them
        clean_text = result.text.replace("```json", "").replace("```", "").strip()
        parsed_data = json.loads(clean_text)

        # 4. Return ONLY the subjects found (No defaults here!)
        return parsed_data.get("subjects", {})

    except Exception as e:
        print(f"❌ Parser Error: {e}")
        return {} # Return empty dict instead of None to avoid crashes