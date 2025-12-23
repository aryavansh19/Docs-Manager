import google.generativeai as genai
import json

# Configure your API Key
genai.configure(api_key="AIzaSyD1mByWj8Su82wAX4upMiG0fWN-qElhX70")


def parse_syllabus_to_json(syllabus_file_path):
    model = genai.GenerativeModel('gemini-3-flash-preview')  # Or 'gemini-3-flash' if available

    # Upload the PDF file
    sample_pdf = genai.upload_file(syllabus_file_path)

    system_prompt = """
    You are a Data Structuring Assistant. 
    Analyze the attached Syllabus PDF. 
    Extract the subject names and their corresponding units/chapters.

    Output STRICT JSON in this exact format, with no markdown or extra text:
    {
      "subjects": [
        {
          "name": "Physics",
          "units": ["Electrostatics", "Current Electricity", "Optics"]
        },
        {
          "name": "Mathematics",
          "units": ["Calculus", "Vectors", "Probability"]
        }
      ]
    }
    """

    response = model.generate_content([system_prompt, sample_pdf])

    # Clean up response to ensure pure JSON
    json_str = response.text.replace("```json", "").replace("```", "")
    return json.loads(json_str)


# Example Usage
syllabus_structure = parse_syllabus_to_json("5th Semester Syllabus (July - Dec 2025).pdf")
print(syllabus_structure)
# Save this 'syllabus_structure' to your Database/JSON file!