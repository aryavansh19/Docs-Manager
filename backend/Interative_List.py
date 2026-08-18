import os

import requests
from dotenv import load_dotenv

load_dotenv()

META_TOKEN = os.getenv("META_TOKEN")
PHONE_NUMBER_ID = os.getenv("PHONE_NUMBER_ID")
# Kept in step with the rest of the app instead of pinning v17.0 here, which meant a
# graph version bump only took effect for some outbound messages.
META_GRAPH_VERSION = os.getenv("META_GRAPH_VERSION", "v17.0")

REQUEST_TIMEOUT = (10, 60)

# Meta's documented ceilings for interactive messages. Exceeding any of them makes the
# whole send fail with a validation error rather than degrading, so every field is
# truncated before it is sent.
MAX_ROWS = 10
MAX_ROW_TITLE = 24
MAX_ROW_DESCRIPTION = 72
MAX_SECTION_TITLE = 24
MAX_BUTTON_TEXT = 20
MAX_HEADER = 60
MAX_BODY = 1024
MAX_FOOTER = 60


def _url() -> str:
    return f"https://graph.facebook.com/{META_GRAPH_VERSION}/{PHONE_NUMBER_ID}/messages"


def _headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {META_TOKEN}",
        "Content-Type": "application/json",
    }


def _post(payload: dict) -> dict:
    try:
        response = requests.post(_url(), headers=_headers(), json=payload, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as exc:
        print(f"WhatsApp interactive send failed: {exc}")
        return {"error": "send_failed"}


def send_interactive_list(
    to_number: str,
    body_text: str,
    button_text: str,
    items: list[dict],
    *,
    section_title: str = "Results",
    header: str | None = None,
    footer: str | None = None,
) -> dict:
    """Send a tappable list menu.

    items = [{'id': 'BROWSE:abc', 'title': 'Unit 1', 'description': 'Physics'}]

    ``section_title`` labels the group in the picker. It used to be hardcoded to
    "Select a File", which mislabelled every folder and search menu that reused this
    helper.
    """
    rows = []
    for item in items[:MAX_ROWS]:
        row = {
            "id": str(item["id"])[:200],
            "title": str(item.get("title") or " ")[:MAX_ROW_TITLE],
        }
        description = str(item.get("description") or "").strip()
        if description:
            row["description"] = description[:MAX_ROW_DESCRIPTION]
        rows.append(row)

    if not rows:
        return {"error": "no_rows"}

    interactive: dict = {
        "type": "list",
        "body": {"text": body_text[:MAX_BODY]},
        "action": {
            "button": button_text[:MAX_BUTTON_TEXT],
            "sections": [{"title": section_title[:MAX_SECTION_TITLE], "rows": rows}],
        },
    }
    if header:
        interactive["header"] = {"type": "text", "text": header[:MAX_HEADER]}
    if footer:
        interactive["footer"] = {"text": footer[:MAX_FOOTER]}

    return _post({
        "messaging_product": "whatsapp",
        "to": to_number,
        "type": "interactive",
        "interactive": interactive,
    })


def send_cta_url(
    to_number: str,
    body_text: str,
    button_text: str,
    url: str,
    *,
    header: str | None = None,
    footer: str | None = None,
) -> dict:
    """Send a message whose call to action is a real tappable button.

    Onboarding links were previously pasted into the message body as bare URLs, which
    WhatsApp renders as small blue text that is easy to miss and awkward to tap. The
    caller receives a falsy result if the send fails so it can fall back to plain text.
    """
    interactive: dict = {
        "type": "cta_url",
        "body": {"text": body_text[:MAX_BODY]},
        "action": {
            "name": "cta_url",
            "parameters": {
                "display_text": button_text[:MAX_BUTTON_TEXT],
                "url": url,
            },
        },
    }
    if header:
        interactive["header"] = {"type": "text", "text": header[:MAX_HEADER]}
    if footer:
        interactive["footer"] = {"text": footer[:MAX_FOOTER]}

    result = _post({
        "messaging_product": "whatsapp",
        "to": to_number,
        "type": "interactive",
        "interactive": interactive,
    })
    return result if "error" not in result else {}
