"""Re-run classification over already indexed files and move the misfiled ones.

Classification improves over time, but existing rows keep whatever folder they were
given when they were ingested. This revisits files that ended up in the fallback folder
and re-files the ones that now have a confident destination.

Choices the user made by hand are never overridden.

Safe by default: reports what it would change. Pass --apply to update the database and
--move to relocate the Drive file as well.

    python reclassify_files.py
    python reclassify_files.py --apply --move
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

FALLBACK_SUBJECTS = ("Imported Documents", "Unsorted")

# Metadata for these came from image labelling, which improves as the labeller does, so
# their titles and keywords are worth regenerating even if the folder is already right.
RELABEL_DOCUMENT_TYPES = (
    "photo", "product_photo", "food_photo", "vehicle_photo", "scenery_photo",
    "person_photo", "event_photo", "image",
)


def _candidates(user_id: str) -> list[dict[str, Any]]:
    """Files worth revisiting: misfiled ones, plus any whose metadata was image derived."""
    query = (
        supabase.table("files")
        .select(
            "id, file_name, drive_file_id, folder_id, subject, unit, mime_type, title, "
            "classification_status, extraction_status, document_type, keywords"
        )
        .eq("user_id", user_id)
    )
    rows = query.execute().data or []

    selected = []
    for row in rows:
        in_fallback = row.get("subject") in FALLBACK_SUBJECTS
        image_derived = (
            row.get("extraction_status") == "visual_only"
            or row.get("document_type") in RELABEL_DOCUMENT_TYPES
        )
        if in_fallback or image_derived:
            selected.append(row)
    return selected


def _move(drive_service, drive_file_id: str, old_folder: str | None, new_folder: str) -> bool:
    kwargs: dict[str, Any] = {"fileId": drive_file_id, "addParents": new_folder, "fields": "id, parents"}
    if old_folder and old_folder != new_folder:
        kwargs["removeParents"] = old_folder
    try:
        drive_service.files().update(**kwargs).execute()
        return True
    except Exception as exc:
        print(f"      ! Drive move failed: {exc}")
        return False


def main() -> None:
    parser = argparse.ArgumentParser(description="Reclassify files sitting in the fallback folder")
    parser.add_argument("--apply", action="store_true", help="write changes to the database")
    parser.add_argument("--move", action="store_true", help="also relocate the Drive file")
    arguments = parser.parse_args()
    if arguments.move and not arguments.apply:
        parser.error("--move requires --apply")
    print(f"mode={'APPLY' if arguments.apply else 'PREVIEW'} drive_moves={'on' if arguments.move else 'off'}")

    profiles = (
        supabase.table("profiles")
        .select("id, google_token, folder_map, root_folder_id")
        .not_.is_("google_token", "null")
        .not_.is_("root_folder_id", "null")
        .execute()
    ).data or []

    for profile in profiles:
        user_id = profile["id"]
        folder_map = profile.get("folder_map") or {}
        rows = _candidates(user_id)
        print(f"\nuser {user_id}: {len(rows)} file(s) in the fallback folder")
        if not rows:
            continue

        drive_service = get_drive_service(profile["google_token"]["refresh_token"])
        valid_folders = _valid_folder_ids(profile)

        for row in rows:
            print(f"  - {row.get('title') or row['file_name']}")
            try:
                data = drive_service.files().get_media(fileId=row["drive_file_id"]).execute()
            except Exception as exc:
                print(f"      ! download failed: {exc}")
                continue

            mime_type = row.get("mime_type") or "application/octet-stream"
            file_name = row.get("file_name") or "document"
            extracted = extract_document(data, mime_type, file_name)
            metadata = build_metadata(extracted, file_name, mime_type, image_data=data)
            if extracted.extraction_status == "no_text" and metadata.keywords:
                extracted.extraction_status = "visual_only"

            classification = classify_document(
                extracted, metadata, file_name, folder_map, profile["root_folder_id"]
            )

            # A hand-picked folder is authoritative, so only the searchable metadata is
            # refreshed for those rows and the destination is left exactly as chosen.
            user_confirmed = row.get("classification_status") == "user_confirmed"
            target = classification.target_folder_id
            improved = (
                not user_confirmed
                and classification.status == "automatic"
                and target != row.get("folder_id")
                and target in valid_folders
            )

            # Keywords change more often than titles as the labeller improves, so they
            # have to be compared too or refreshed vocabulary is silently skipped.
            title_changed = (
                (metadata.title or "") != (row.get("title") or "")
                or metadata.document_type != row.get("document_type")
                or list(metadata.keywords or []) != list(row.get("keywords") or [])
            )
            print(f"      title: {row.get('title')!r} -> {metadata.title!r}")
            if not user_confirmed:
                print(f"      now: {classification.target_label} ({classification.status}, {classification.confidence})")
            else:
                print("      folder: kept (user confirmed)")

            if not improved and not title_changed:
                print("      no change")
                continue
            if not arguments.apply:
                print(f"      would {'move and ' if improved else ''}refresh metadata")
                continue

            payload: dict[str, Any] = {
                "document_type": metadata.document_type,
                "title": metadata.title,
                "summary": metadata.summary,
                "keywords": metadata.keywords,
                "extraction_status": extracted.extraction_status,
            }
            if not user_confirmed:
                payload["classification_confidence"] = classification.confidence
                payload["classification_status"] = classification.status

            moved = False
            if improved and arguments.move:
                moved = _move(drive_service, row["drive_file_id"], row.get("folder_id"), target)
            if moved:
                payload.update({
                    "folder_id": target,
                    "subject": classification.subject,
                    "unit": classification.unit,
                })

            # Keep the vectors aligned with the refreshed metadata.
            vectors = embed_texts([" ".join(filter(None, [
                metadata.title,
                (metadata.document_type or "").replace("_", " "),
                " ".join(metadata.keywords[:20]),
                metadata.summary[:800],
            ]))])
            if vectors and vectors[0]:
                payload["embedding"] = vectors[0]

            if mime_type.startswith("image/"):
                description = describe_image(data)
                if description and description.vector:
                    payload["image_embedding"] = description.vector

            supabase.table("files").update(payload).eq("id", row["id"]).eq("user_id", user_id).execute()
            print(f"      updated{' and moved' if arguments.move and moved else ''}")


if __name__ == "__main__":
    main()
