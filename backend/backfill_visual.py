"""Backfill visual understanding for image files indexed before CLIP was added.

Older image rows have no image_embedding, and photographs that produced no OCR text
were left with no title, keywords, or vector, so they were unsearchable. This script
recomputes metadata, embeddings, and classification for those rows.

Safe by default: it reports what it would change and writes nothing. Pass --apply to
update the database, and additionally --move to relocate Drive files whose folder
changed. Drive moves are opt-in because they alter the user's Drive.

    python backfill_visual.py                 # preview only
    python backfill_visual.py --apply         # update database, leave Drive alone
    python backfill_visual.py --apply --move  # also move Drive files
"""

from __future__ import annotations

import argparse
from typing import Any

from document_ingestion import _valid_folder_ids
from document_pipeline import (
    build_metadata,
    classify_document,
    describe_image,
    embed_texts,
    extract_document,
)
from google_auth import get_drive_service
from supabase_client import supabase

# Rows worth revisiting: no visual vector yet, nothing readable was ever extracted, or
# the metadata came from image labelling and can improve as the labeller does.
REVISIT_STATUSES = ("no_text", "unsupported", "visual_only")


def _load_profiles() -> list[dict[str, Any]]:
    response = (
        supabase.table("profiles")
        .select("id, google_token, folder_map, root_folder_id")
        .not_.is_("google_token", "null")
        .not_.is_("root_folder_id", "null")
        .execute()
    )
    return response.data or []


def _candidate_files(user_id: str) -> list[dict[str, Any]]:
    response = (
        supabase.table("files")
        .select(
            "id, file_name, original_name, drive_file_id, folder_id, subject, unit, "
            "mime_type, title, extraction_status, document_type, classification_status"
        )
        .eq("user_id", user_id)
        .like("mime_type", "image/%")
        .execute()
    )
    rows = response.data or []

    needs_vector = (
        supabase.table("files")
        .select("id")
        .eq("user_id", user_id)
        .like("mime_type", "image/%")
        .is_("image_embedding", "null")
        .execute()
    )
    missing_vector_ids = {row["id"] for row in (needs_vector.data or [])}

    return [
        row for row in rows
        if row["id"] in missing_vector_ids or row.get("extraction_status") in REVISIT_STATUSES
    ]


def _move_drive_file(drive_service, drive_file_id: str, old_folder_id: str | None, new_folder_id: str) -> bool:
    """Relocate a Drive file, restoring the original parent if the move half-fails."""
    kwargs: dict[str, Any] = {
        "fileId": drive_file_id,
        "addParents": new_folder_id,
        "fields": "id, parents",
    }
    if old_folder_id and old_folder_id != new_folder_id:
        kwargs["removeParents"] = old_folder_id
    try:
        drive_service.files().update(**kwargs).execute()
        return True
    except Exception as exc:
        print(f"    ! Drive move failed: {exc}")
        return False


def backfill_user(profile: dict[str, Any], *, apply: bool, move: bool) -> tuple[int, int]:
    user_id = profile["id"]
    folder_map = profile.get("folder_map") or {}
    root_folder_id = profile.get("root_folder_id")
    candidates = _candidate_files(user_id)
    if not candidates:
        return 0, 0

    print(f"user {user_id}: {len(candidates)} image file(s) to revisit")
    drive_service = get_drive_service(profile["google_token"]["refresh_token"])
    valid_folders = _valid_folder_ids(profile)

    examined = 0
    changed = 0
    for row in candidates:
        examined += 1
        print(f"  - {row.get('title') or row['file_name']}")
        try:
            data = drive_service.files().get_media(fileId=row["drive_file_id"]).execute()
        except Exception as exc:
            print(f"    ! could not download from Drive: {exc}")
            continue

        mime_type = row.get("mime_type") or "image/jpeg"
        file_name = row.get("file_name") or "image"
        extracted = extract_document(data, mime_type, file_name)
        metadata = build_metadata(extracted, file_name, mime_type, image_data=data)
        if extracted.extraction_status == "no_text" and metadata.keywords:
            extracted.extraction_status = "visual_only"

        classification = classify_document(
            extracted, metadata, file_name, folder_map, root_folder_id
        )

        description = describe_image(data)
        image_embedding = description.vector if description else None

        file_embedding = None
        chunk_embeddings: list[Any] = []
        if extracted.extraction_status in {"complete", "visual_only"}:
            embedding_input = "\n".join(filter(None, [
                metadata.title,
                (metadata.document_type or "").replace("_", " "),
                " ".join(metadata.keywords[:20]),
                metadata.summary[:800],
            ]))
            vectors = embed_texts([embedding_input, *[chunk.content for chunk in extracted.chunks]])
            file_embedding = vectors[0] if vectors else None
            chunk_embeddings = vectors[1:] if len(vectors) > 1 else []

        # A choice the user made by hand outranks anything the classifier infers, so
        # confirmed rows keep their folder and status and are never re-prompted.
        user_confirmed = row.get("classification_status") == "user_confirmed"

        target_folder_id = classification.target_folder_id
        folder_will_change = (
            not user_confirmed
            and classification.status == "automatic"
            and target_folder_id != row.get("folder_id")
            and target_folder_id in valid_folders
        )

        print(f"    type={metadata.document_type} title={metadata.title!r}")
        if user_confirmed:
            print("    status=user_confirmed (preserved) destination unchanged")
        else:
            print(f"    status={classification.status} destination={classification.target_label}")
        print(f"    image_vector={'yes' if image_embedding else 'no'} folder_change={folder_will_change}")

        if not apply:
            continue

        payload: dict[str, Any] = {
            "document_type": metadata.document_type,
            "title": metadata.title,
            "summary": metadata.summary,
            "keywords": metadata.keywords,
            "entities": metadata.entities,
            "extraction_status": extracted.extraction_status,
            "extraction_method": extracted.extraction_method,
            "embedding": file_embedding,
            "image_embedding": image_embedding,
        }

        if not user_confirmed:
            payload.update({
                "classification_confidence": classification.confidence,
                "classification_status": classification.status,
                "classification_candidates": [
                    {
                        "folder_id": candidate.folder_id,
                        "label": candidate.label,
                        "subject": candidate.subject,
                        "unit": candidate.unit,
                        "score": candidate.score,
                    }
                    for candidate in classification.alternatives
                ],
            })

        moved = False
        if folder_will_change and move:
            moved = _move_drive_file(
                drive_service, row["drive_file_id"], row.get("folder_id"), target_folder_id
            )
            if moved:
                payload["folder_id"] = target_folder_id
                payload["subject"] = classification.subject
                payload["unit"] = classification.unit

        payload["tags"] = list(dict.fromkeys([
            payload.get("subject") or row.get("subject"),
            *([payload.get("unit") or row.get("unit")] if (payload.get("unit") or row.get("unit")) else []),
            *metadata.keywords[:12],
        ]))

        try:
            supabase.table("files").update(payload).eq("id", row["id"]).eq("user_id", user_id).execute()
        except Exception as exc:
            print(f"    ! database update failed: {exc}")
            if moved:
                _move_drive_file(
                    drive_service, row["drive_file_id"], target_folder_id, row.get("folder_id") or root_folder_id
                )
            continue

        if extracted.chunks:
            try:
                supabase.table("document_chunks").delete().eq("file_id", row["id"]).eq("user_id", user_id).execute()
                supabase.table("document_chunks").insert([
                    {
                        "file_id": row["id"],
                        "user_id": user_id,
                        "chunk_index": chunk.index,
                        "page_number": chunk.page_number,
                        "content": chunk.content,
                        "embedding": chunk_embeddings[index] if index < len(chunk_embeddings) else None,
                    }
                    for index, chunk in enumerate(extracted.chunks)
                ]).execute()
            except Exception as exc:
                print(f"    ! chunk reindex failed: {exc}")

        changed += 1
        print("    updated")

    return examined, changed


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill visual understanding for image files")
    parser.add_argument("--apply", action="store_true", help="write changes to the database")
    parser.add_argument("--move", action="store_true", help="also relocate Drive files whose folder changed")
    arguments = parser.parse_args()

    if arguments.move and not arguments.apply:
        parser.error("--move requires --apply")

    mode = "APPLY" if arguments.apply else "PREVIEW"
    print(f"mode={mode} drive_moves={'on' if arguments.move else 'off'}")

    total_examined = 0
    total_changed = 0
    for profile in _load_profiles():
        examined, changed = backfill_user(profile, apply=arguments.apply, move=arguments.move)
        total_examined += examined
        total_changed += changed

    print(f"examined={total_examined} updated={total_changed}")


if __name__ == "__main__":
    main()
