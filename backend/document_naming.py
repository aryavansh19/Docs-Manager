"""LLM-derived document descriptions, used to name files and make them findable.

Why this module exists. Naming used to come from three heuristics: the biggest-font OCR
region, the first line in reading order, and for photos a CLIP zero-shot label. The CLIP
path is the one that named a photo of a slipper "medical prescription" -- it does not
describe an image, it picks the nearest match from a fixed list of labels, so anything
outside that list gets named wrongly, confidently, and no amount of tuning changes that.

Two providers, because they fail in opposite directions:

* Groq is fast and cheap and reads extracted text well, but it cannot see an image. Given
  a photo with no readable text there is simply nothing for it to work from.
* Gemini accepts the image itself, which is the only way to name a photo that carries no
  text -- precisely the case the old CLIP path got wrong.

So text goes to Groq and images go to Gemini, each when its key is present, with either
able to cover for the other. Every failure path returns None and the caller keeps its
existing heuristics: a file that lands with a mediocre name is a small problem, and a file
that fails to land at all is a large one.

Both models are env-overridable. Model names churn, and a 404 on a retired name should be
a one-line env change rather than a deploy.
"""

from __future__ import annotations

import base64
import json
import os
import re
from dataclasses import dataclass

import requests

# Bump when the prompt or the schema changes, so a future backfill can tell which rows were
# described by which version instead of silently mixing two vocabularies in one index.
PROMPT_VERSION = 1

# Connect and read timeouts. Ingestion already runs in a background worker with a lease
# heartbeat, so a slow answer costs latency rather than correctness -- but the read timeout
# still has to be well under the lease so a hung provider cannot lose the job.
_TIMEOUT = (5, 25)

# Sending a very large image wastes the request and risks a provider-side rejection. Above
# this we fall back to describing the extracted text.
_MAX_INLINE_IMAGE_BYTES = 4 * 1024 * 1024

# Enough text to identify a document. The first page or two carries the title, heading and
# subject; further pages rarely change what the thing *is*.
_MAX_TEXT_CHARS = 6000

GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions"
GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


def _groq_key() -> str:
    return (os.getenv("GROQ_API_KEY") or "").strip()


def _gemini_key() -> str:
    return (os.getenv("GEMINI_API_KEY") or "").strip()


def _groq_model() -> str:
    # Chosen off the live model list rather than from memory: this account serves no Llama
    # models at all, and a retired name returns 404 on every call.
    return os.getenv("GROQ_NAMING_MODEL", "openai/gpt-oss-120b")


def _gemini_model() -> str:
    # Flash-lite is enough for naming, and it accepts images, which is the whole reason
    # Gemini is in the routing at all.
    return os.getenv("GEMINI_NAMING_MODEL", "gemini-3.5-flash-lite")


@dataclass(slots=True)
class DocumentDescription:
    title: str
    document_type: str
    keywords: list[str]
    summary: str
    provider: str


# Written for recall rather than description. Someone will look for this file months from
# now with a half-remembered phrase, so specifics beat prose. Permission to say "unclear" is
# deliberate and is the direct fix for the slipper problem: a vague but honest name is far
# better than a confident wrong one, because a wrong name sends the searcher looking for a
# document that does not exist.
_SYSTEM_INSTRUCTION = """\
You name and index documents for a personal filing system. Your output is used as the \
file's name and as its search text, months after it was saved.

Rules:

- title: a short specific name for THIS document, 3 to 8 words. Name the subject, the \
paper, the bill, the object. No file extension, no date, no quotes. Never begin with \
"Document", "Scan", "Photo of", "Image of" or "This".
- If it is coursework, lead with the subject and unit as written on the page, for example \
"Physics Unit 3 Memory Hierarchy".
- If it is a everyday document, name the kind and who issued it, for example \
"Electricity Bill Uttarakhand Power".
- If it is a photograph of an object rather than a document, name the object plainly, for \
example "Blue Slippers". Do not dress it up as paperwork.
- document_type: one lowercase token such as notes, assignment, bill, receipt, \
prescription, certificate, id_card, ticket, form, letter, photo, screenshot, other.
- keywords: 5 to 12 lowercase terms someone might search for. Specific first. Include \
subject, topic, issuer, named entities and numbers that appear.
- summary: one sentence under 25 words, starting with the thing itself.
- If you genuinely cannot tell what it is, say so plainly in the summary and give the most \
literal title you can defend. An honest vague answer beats an invented specific one, \
because a wrong name is worse than a weak one.

Reply with only a JSON object: \
{"title": str, "document_type": str, "keywords": [str], "summary": str}"""


def _user_prompt(text: str, mime_type: str, *, image_attached: bool) -> str:
    trimmed = _trim(text, _MAX_TEXT_CHARS)
    if image_attached:
        head = (
            "Name and index this document. The image is attached — look at it.\n\n"
            f"File type: {mime_type}\n\n"
        )
        body = (
            f"Text found in the image by OCR (may be empty, partial or garbled):\n"
            f"----\n{trimmed}\n----\n\n"
            if trimmed.strip()
            else "OCR found no readable text in this image, so rely on what you see.\n\n"
        )
        return head + body + "Produce the JSON object."
    return (
        "Name and index this document.\n\n"
        f"File type: {mime_type}\n\n"
        f"Text extracted from it:\n"
        f"----\n{trimmed}\n----\n\n"
        "Produce the JSON object."
    )


def _trim(text: str, max_chars: int) -> str:
    """Trim at a boundary rather than mid-word.

    The tail of a truncated sentence reads as content to the model and can seed a wrong
    title, which is the one field here that becomes permanent.
    """
    text = (text or "").strip()
    if len(text) <= max_chars:
        return text
    window = text[:max_chars]
    for boundary in ("\n\n", ". ", "\n", " "):
        cut = window.rfind(boundary)
        if cut > max_chars * 0.6:
            return window[:cut].rstrip() + "\n[...truncated]"
    return window.rstrip() + "\n[...truncated]"


def _coerce(payload: dict, provider: str) -> DocumentDescription | None:
    """Validate the model's JSON into something safe to name a file after."""
    title = str(payload.get("title") or "").strip()
    # Models occasionally answer with the instruction echoed back, or with a lead-in the
    # prompt told them to avoid. Neither makes a usable filename.
    title = re.sub(r"^(?:title|name)\s*[:\-]\s*", "", title, flags=re.IGNORECASE).strip(" \"'")
    if not title or not re.search(r"[A-Za-z0-9]", title):
        return None

    keywords: list[str] = []
    raw_keywords = payload.get("keywords")
    if isinstance(raw_keywords, list):
        for keyword in raw_keywords:
            cleaned = str(keyword).strip().lower()
            if cleaned and cleaned not in keywords:
                keywords.append(cleaned)

    document_type = str(payload.get("document_type") or "").strip().lower()
    document_type = re.sub(r"[^a-z_]+", "_", document_type).strip("_")

    return DocumentDescription(
        title=title[:120],
        document_type=document_type or "other",
        keywords=keywords[:12],
        summary=str(payload.get("summary") or "").strip()[:600],
        provider=provider,
    )


def _parse_json_block(raw: str) -> dict | None:
    """Read a JSON object out of a model reply.

    Both providers are asked for JSON, and both usually comply, but a stray code fence or a
    sentence before the object is common enough that failing the whole naming call over it
    would be careless.
    """
    raw = (raw or "").strip()
    if not raw:
        return None
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else None
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if not match:
        return None
    try:
        parsed = json.loads(match.group(0))
        return parsed if isinstance(parsed, dict) else None
    except json.JSONDecodeError:
        return None


def _describe_with_groq(text: str, mime_type: str) -> DocumentDescription | None:
    response = requests.post(
        GROQ_ENDPOINT,
        headers={
            "Authorization": f"Bearer {_groq_key()}",
            "Content-Type": "application/json",
        },
        json={
            "model": _groq_model(),
            "messages": [
                {"role": "system", "content": _SYSTEM_INSTRUCTION},
                {"role": "user", "content": _user_prompt(text, mime_type, image_attached=False)},
            ],
            "response_format": {"type": "json_object"},
            # Naming is an extraction task, not a creative one. Low temperature keeps the
            # same document from being named two different things on a retry.
            "temperature": 0.1,
            "max_tokens": 600,
        },
        timeout=_TIMEOUT,
    )
    response.raise_for_status()
    choices = response.json().get("choices") or []
    if not choices:
        return None
    payload = _parse_json_block(choices[0].get("message", {}).get("content", ""))
    return _coerce(payload, "groq") if payload else None


def _describe_with_gemini(
    text: str, mime_type: str, image_data: bytes | None
) -> DocumentDescription | None:
    parts: list[dict] = [
        {"text": _user_prompt(text, mime_type, image_attached=image_data is not None)}
    ]
    if image_data is not None:
        parts.append({
            "inline_data": {
                "mime_type": mime_type,
                "data": base64.b64encode(image_data).decode("ascii"),
            }
        })

    response = requests.post(
        GEMINI_ENDPOINT.format(model=_gemini_model()),
        # The key goes in a header, never in the query string. Gemini accepts ?key=, but
        # requests puts the full URL into HTTPError messages, so a single 404 would write
        # the API key into the service journal and into any error we print or report.
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": _gemini_key(),
        },
        json={
            "systemInstruction": {"parts": [{"text": _SYSTEM_INSTRUCTION}]},
            "contents": [{"role": "user", "parts": parts}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": 0.1,
                "maxOutputTokens": 600,
            },
        },
        timeout=_TIMEOUT,
    )
    response.raise_for_status()
    candidates = response.json().get("candidates") or []
    if not candidates:
        return None
    reply_parts = (candidates[0].get("content") or {}).get("parts") or []
    raw = "".join(part.get("text", "") for part in reply_parts)
    payload = _parse_json_block(raw)
    return _coerce(payload, "gemini") if payload else None


def describe_document(
    *,
    text: str,
    mime_type: str,
    image_data: bytes | None = None,
) -> DocumentDescription | None:
    """Ask a model what this document is. Returns None if it cannot say.

    Routing follows what each provider can actually do rather than a preference order: an
    image goes to Gemini because it can see it, and text goes to Groq because it is faster.
    Each covers for the other when only one key is configured.
    """
    has_text = bool((text or "").strip())
    send_image = (
        image_data is not None
        and mime_type.startswith("image/")
        and len(image_data) <= _MAX_INLINE_IMAGE_BYTES
    )

    attempts: list[tuple[str, object]] = []
    if send_image and _gemini_key():
        attempts.append(("gemini-vision", lambda: _describe_with_gemini(text, mime_type, image_data)))
    if has_text and _groq_key():
        attempts.append(("groq", lambda: _describe_with_groq(text, mime_type)))
    if has_text and _gemini_key():
        attempts.append(("gemini-text", lambda: _describe_with_gemini(text, mime_type, None)))

    for label, attempt in attempts:
        try:
            description = attempt()  # type: ignore[operator]
        except requests.RequestException as exc:
            print(f"Document naming via {label} failed: {exc}")
            continue
        except Exception as exc:
            print(f"Document naming via {label} raised: {exc}")
            continue
        if description:
            return description
        print(f"Document naming via {label} returned nothing usable")
    return None
