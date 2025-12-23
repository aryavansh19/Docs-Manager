from flask import Flask, request, jsonify
import requests
import os

app = Flask(__name__)

# --- CONFIGURATION ---
# Replace with your actual Permanent Access Token from Business Settings
ACCESS_TOKEN = "EAAUAGdZBGBRcBQfVVIZB8Qxa2eCcvNHpP1slj0DzVpFy0ju4vs9rtufWi4yZBTGHDIzDHriAZCh8I3J6hF6YFfY4pb1TC1AdCmfzZBS6vxTlqZCbDHPcck129LK6xuAR4wJDuO5uT2eNyAY6Qfp7j73sW4AfBPkTAhZBGsoEI4lwNO8nMc3sOAj6hq51dQZBAS5A8A32aAM3yBGr9MvQAOtLF84sDcew2RTkRDqmBQqMREvO5UqLLxrHaGU3MfGqKC0LqzttOtl5FQO5AcexGBen1j9PeFLGuSZB06cAaQVEZD"
# Replace with your Phone Number ID (from App Dashboard)
PHONE_NUMBER_ID = "837198326154391"
# Choose any password you like (you will type this into the Dashboard later)
VERIFY_TOKEN = "my_secure_password"


# --- 1. VERIFICATION ENDPOINT (GET) ---
# Meta sends a GET request to verify your server is running and secure
@app.route('/webhook', methods=['GET'])
def verify_webhook():
    mode = request.args.get('hub.mode')
    token = request.args.get('hub.verify_token')
    challenge = request.args.get('hub.challenge')

    if mode and token:
        if mode == 'subscribe' and token == VERIFY_TOKEN:
            print("WEBHOOK_VERIFIED")
            return challenge, 200
        else:
            return "Verification failed", 403
    return "Hello World", 200


# --- 2. MESSAGE RECEIVER (POST) ---
# Meta sends incoming WhatsApp messages here
@app.route('/webhook', methods=['POST'])
def receive_message():
    print("\n--- INCOMING WEBHOOK ---")

    # 1. Get the raw JSON
    body = request.get_json()

    # 2. Print it nicely to the terminal
    import json
    print(json.dumps(body, indent=2))

    # 3. Always return 200 OK to Meta so they don't stop sending
    return "EVENT_RECEIVED", 200

# --- HELPER FUNCTION TO SEND MESSAGES ---
def send_reply(to, text_body):
    url = f"https://graph.facebook.com/v22.0/{PHONE_NUMBER_ID}/messages"
    headers = {
        "Authorization": f"Bearer {ACCESS_TOKEN}",
        "Content-Type": "application/json"
    }
    data = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {"body": text_body}
    }

    response = requests.post(url, headers=headers, json=data)
    if response.status_code == 200:
        print("Reply sent successfully!")
    else:
        print(f"Failed to send reply: {response.text}")


if __name__ == '__main__':
    app.run(port=3000, debug=True)