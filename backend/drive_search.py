from __future__ import annotations

import re
from typing import Any

from rapidfuzz.fuzz import WRatio, token_set_ratio

from document_pipeline import embed_image_query, embed_query, rerank_passages
from google_auth import get_drive_service
from supabase_client import supabase

# Fusion ranking is only used to gather candidates; the cross-encoder decides the
# final order, so it is given more rows than the caller asked for.
RERANK_CANDIDATE_MULTIPLIER = 3
RERANK_CANDIDATE_CAP = 30

# Thresholds for auto-sending a single result. Cross-encoder scores are comparable
# across queries, so these are meaningful absolute values.
#
# The single-result bar is deliberately low: candidates have already been filtered by
# MIN_RESULT_RELEVANCE, so if exactly one file in the whole library is relevant at all,
# sending it beats making the user tap through a one-item list. Short queries such as
# "pipeline" score low on a cross-encoder trained for question-passage pairs even when
# the match is obviously correct.
RERANKED_SINGLE_SCORE = 0.35
RERANKED_TOP_SCORE = 0.60
RERANKED_MARGIN = 0.15

# CLIP text-to-image similarities sit in a narrow band because of the modality gap, so
# neither the absolute value nor a min-max rescale is trustworthy on its own: rescaling
# always promotes the best of an irrelevant set. Visual credit therefore goes only to a
# single standout candidate that clears an absolute floor and clearly beats the next one.
#
# Measured against a real library, every query scored between 0.24 and 0.30 whether or not
# any file was relevant, and the margin alone decided the outcome. These bars are raised
# accordingly, but the real safeguard is the trust cap below.
VISUAL_RAW_FLOOR = 0.24
VISUAL_RAW_MARGIN = 0.04
# Visual evidence is a hint, never an answer. Capped below RERANKED_SINGLE_SCORE so a
# purely visual match is always offered as a choice instead of being sent automatically.
# Testing showed visual-only matches returning the wrong file with apparent confidence.
VISUAL_TRUST_CAP = 0.30

# Candidate generation is deliberately broad, so anything the reranker scores at or below
# this is not worth showing. Without it every indexed file appears in the match list.
# Raised from 0.05 after a search for "chair" surfaced a bag on a 0.08 association.
MIN_RESULT_RELEVANCE = 0.12

# Fallback thresholds for the uncalibrated fusion score, used only when the
# reranker cannot be loaded.
FUSION_SINGLE_SCORE = 0.72
FUSION_TOP_SCORE = 0.76
FUSION_MARGIN = 0.10


def _normalize(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (value or "").lower()).strip()


def find_folder_match(user: dict[str, Any], query: str) -> dict[str, Any] | None:
    """Return a folder only for a clear name match; never match an empty query."""
    normalized_query = _normalize(query)
    if len(normalized_query) < 2:
        return None

    choices: list[tuple[float, int, dict[str, Any]]] = []
    for subject, data in (user.get("folder_map") or {}).items():
        if not isinstance(data, dict) or not data.get("id"):
            continue
        normalized_name = _normalize(subject)
        exact_context = normalized_name == normalized_query or (
            len(normalized_name) >= 4 and re.search(rf"\b{re.escape(normalized_name)}\b", normalized_query)
        )
        score = 100.0 if exact_context else max(
            WRatio(normalized_query, normalized_name),
            token_set_ratio(normalized_query, normalized_name),
        )
        if exact_context or score >= 90:
            choices.append((score, len(normalized_name), {
                "type": "SUBJECT",
                "name": subject,
                "id": str(data["id"]),
                "children": data.get("units") or {},
            }))

        for unit_name, unit_id in (data.get("units") or {}).items():
            normalized_unit = _normalize(unit_name)
            exact_context = normalized_unit == normalized_query or (
                len(normalized_unit) >= 4 and re.search(rf"\b{re.escape(normalized_unit)}\b", normalized_query)
            )
            score = 100.0 if exact_context else max(
                WRatio(normalized_query, normalized_unit),
                token_set_ratio(normalized_query, normalized_unit),
            )
            if exact_context or score >= 90:
                choices.append((score, len(normalized_unit), {
                    "type": "UNIT",
                    "name": unit_name,
                    "parent": subject,
                    "id": str(unit_id),
                    "children": None,
                }))

    if not choices:
        return None
    choices.sort(key=lambda item: (item[0], item[1]), reverse=True)
    return choices[0][2]


def _fallback_metadata_search(user_id: str, query: str, limit: int) -> list[dict[str, Any]]:
    response = (
        supabase.table("files")
        .select("id, drive_file_id, file_name, folder_id, subject, unit, title, summary, document_type, mime_type, tags, keywords")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(250)
        .execute()
    )
    normalized_query = _normalize(query)
    matches = []
    for row in response.data or []:
        searchable = " ".join(filter(None, [
            row.get("file_name"),
            row.get("title"),
            row.get("subject"),
            row.get("unit"),
            row.get("summary"),
            " ".join(row.get("keywords") or []),
        ]))
        score = token_set_ratio(normalized_query, _normalize(searchable)) / 100.0
        if score >= 0.25:
            row["relevance"] = score
            row["matched_excerpt"] = (row.get("summary") or "")[:280]
            matches.append(row)
    matches.sort(key=lambda item: item["relevance"], reverse=True)
    return matches[:limit]


# WhatsApp queries are usually commands rather than questions ("send me my photo"),
# and the cross-encoder was trained on question/passage pairs, so this filler drags
# scores down. Stripping it leaves the words that actually describe the file.
_QUERY_NOISE = {
    "a", "again", "an", "any", "back", "bring", "can", "do", "fetch", "find", "for",
    "get", "give", "have", "i", "it", "me", "mine", "my", "need", "now", "of", "please",
    "pls", "plz", "send", "sent", "share", "show", "some", "that", "the", "this", "to",
    "u", "want", "you",
    # Container words describing the wrapper rather than the content. "give pipeline
    # notes" and "give pipeline image" should behave identically, and they did not.
    "copy", "doc", "docs", "document", "documents", "file", "files", "img", "image",
    "images", "note", "notes", "pdf", "photo", "photos", "pic", "pics", "picture",
    "pictures", "scan", "scans", "screenshot", "screenshots",
}


def _core_query(query: str) -> str:
    """Reduce a spoken-style request to the terms that describe the wanted file."""
    tokens = re.findall(r"[A-Za-z0-9+#.]+", (query or "").lower())
    kept = [token for token in tokens if token not in _QUERY_NOISE]
    return " ".join(kept) or query.strip()


def _clean_name(value: str | None) -> str:
    """Drop machine-generated filename noise that would confuse the reranker."""
    stem = re.sub(r"\.[A-Za-z0-9]{1,5}$", "", value or "")
    tokens = re.split(r"[^A-Za-z0-9]+", stem)
    keep = []
    for token in tokens:
        if not token or len(token) > 20:
            continue
        digits = sum(character.isdigit() for character in token)
        if digits > len(token) / 2:
            continue
        keep.append(token)
    return " ".join(keep)


def _passage_for_rerank(row: dict[str, Any]) -> str:
    """Build the text the cross-encoder compares against the query."""
    parts = [
        row.get("title"),
        _clean_name(row.get("file_name")),
        row.get("subject"),
        row.get("unit"),
        (row.get("document_type") or "").replace("_", " "),
        " ".join(row.get("keywords") or []),
        row.get("matched_excerpt") or row.get("summary"),
    ]
    return " ".join(part for part in parts if part)


def _calibrated_visual_scores(rows: list[dict[str, Any]]) -> list[float]:
    """Award visual credit only to a single, unambiguous visual match.

    Every image in a small library scores similarly against any query, so a relative
    rescale would hand the top slot to an unrelated file. Credit is granted only when
    one candidate clears an absolute floor and beats the runner-up by a clear margin.
    """
    raw_scores = [float(row.get("visual_relevance") or 0) for row in rows]
    if not any(raw_scores):
        return [0.0 for _ in raw_scores]

    ordered = sorted(raw_scores, reverse=True)
    best = ordered[0]
    runner_up = ordered[1] if len(ordered) > 1 else 0.0

    if best < VISUAL_RAW_FLOOR or best - runner_up < VISUAL_RAW_MARGIN:
        return [0.0 for _ in raw_scores]

    return [VISUAL_TRUST_CAP if value == best else 0.0 for value in raw_scores]


def _apply_rerank(query: str, rows: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
    """Rescore candidates with the cross-encoder and order by calibrated relevance."""
    if not rows:
        return []

    scores = rerank_passages(query, [_passage_for_rerank(row) for row in rows])
    if scores is None:
        for row in rows:
            row["rerank_applied"] = False
        return rows[:limit]

    # The cross-encoder only reads text, so a photograph matched purely on what it
    # depicts would otherwise be scored zero and lost.
    visual_scores = _calibrated_visual_scores(rows)

    for row, score, visual in zip(rows, scores, visual_scores):
        # Keep the fusion score for debugging, but relevance is now the calibrated one.
        row["fusion_relevance"] = row.get("relevance")
        row["text_relevance"] = score
        row["visual_score"] = round(visual, 4)
        row["relevance"] = max(score, round(visual, 4))
        row["rerank_applied"] = True

    rows.sort(key=lambda item: float(item.get("relevance") or 0), reverse=True)
    # Drop candidates the reranker found irrelevant so the user is offered real options
    # instead of the whole library.
    relevant = [row for row in rows if float(row.get("relevance") or 0) > MIN_RESULT_RELEVANCE]
    return relevant[:limit]


def search_files_in_db(user_id: str, query: str, limit: int = 10) -> list[dict[str, Any]]:
    """Hybrid retrieval scoped to one user, reordered by a local cross-encoder."""
    query = re.sub(r"\s+", " ", query or "").strip()
    if len(query) < 2:
        return []

    candidate_count = max(limit, min(limit * RERANK_CANDIDATE_MULTIPLIER, RERANK_CANDIDATE_CAP))
    core_query = _core_query(query)
    query_vector = embed_query(core_query)
    # Lets a text query reach photographs by what they depict, not just by their text.
    image_query_vector = embed_image_query(core_query)
    try:
        response = supabase.rpc("hybrid_search_files", {
            "p_user_id": user_id,
            "p_query": core_query,
            "p_query_embedding": query_vector,
            "p_match_count": candidate_count,
            "p_rrf_k": 50,
            "p_image_query_embedding": image_query_vector,
        }).execute()
        rows = response.data or []
    except Exception as exc:
        print(f"Hybrid search RPC failed; using metadata fallback: {exc}")
        rows = _fallback_metadata_search(user_id, core_query, candidate_count)

    return _apply_rerank(core_query, rows, limit)


def should_send_directly(results: list[dict[str, Any]]) -> bool:
    """Auto-send only when the top result is clearly the intended one."""
    if not results:
        return False

    top = float(results[0].get("relevance") or 0)
    reranked = bool(results[0].get("rerank_applied"))
    single_score = RERANKED_SINGLE_SCORE if reranked else FUSION_SINGLE_SCORE
    top_score = RERANKED_TOP_SCORE if reranked else FUSION_TOP_SCORE
    margin = RERANKED_MARGIN if reranked else FUSION_MARGIN

    if len(results) == 1:
        return top >= single_score

    second = float(results[1].get("relevance") or 0)
    return top >= top_score and top - second >= margin


def record_search_feedback(
    user_id: str,
    query: str,
    results: list[dict[str, Any]],
    selected_file_id: str | None = None,
    feedback_type: str = "selected",
) -> None:
    try:
        supabase.table("search_feedback").insert({
            "user_id": user_id,
            "query": query,
            "shown_file_ids": [row["id"] for row in results if row.get("id")],
            "selected_file_id": selected_file_id,
            "feedback_type": feedback_type,
        }).execute()
    except Exception as exc:
        print(f"Could not record search feedback: {exc}")


def get_owned_file(user_id: str, *, file_id: str | None = None, drive_file_id: str | None = None) -> dict[str, Any] | None:
    query = supabase.table("files").select("id, drive_file_id, file_name, folder_id, subject, unit").eq("user_id", user_id)
    if file_id:
        query = query.eq("id", file_id)
    elif drive_file_id:
        query = query.eq("drive_file_id", drive_file_id)
    else:
        return None
    response = query.limit(1).execute()
    return response.data[0] if response.data else None


def get_drive_link(google_token: str, file_id: str) -> str | None:
    try:
        service = get_drive_service(google_token)
        file = service.files().get(fileId=file_id, fields="webViewLink").execute()
        return file.get("webViewLink")
    except Exception as exc:
        print(f"Drive link fetch failed: {exc}")
        return None
