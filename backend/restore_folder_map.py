"""Rebuild profiles.folder_map from the real Google Drive folder tree.

The syllabus upload endpoint used to overwrite folder_map with parsed subject names,
destroying the mapping to actual Drive folder IDs. The folders themselves still exist,
so the map can be recovered by walking the tree under root_folder_id.

Safe by default: reports what it would write. Pass --apply to persist.

    python restore_folder_map.py
    python restore_folder_map.py --apply
"""

from __future__ import annotations

import argparse
from typing import Any

from google_auth import get_drive_service
from supabase_client import supabase

FOLDER_MIME = "application/vnd.google-apps.folder"


def _child_folders(service, parent_id: str) -> list[dict[str, str]]:
    """List immediate subfolders of a Drive folder, following pagination."""
    folders: list[dict[str, str]] = []
    page_token = None
    while True:
        response = service.files().list(
            q=f"'{parent_id}' in parents and mimeType='{FOLDER_MIME}' and trashed=false",
            fields="nextPageToken, files(id, name)",
            pageSize=200,
            pageToken=page_token,
        ).execute()
        folders.extend({"id": item["id"], "name": item["name"]} for item in response.get("files", []))
        page_token = response.get("nextPageToken")
        if not page_token:
            break
    return folders


def _candidate_roots(service) -> list[dict[str, str]]:
    """List every workspace root this account has accumulated, newest first."""
    try:
        response = service.files().list(
            q=(
                f"mimeType='{FOLDER_MIME}' and trashed=false "
                "and (name contains 'DocsFlow' or name contains 'SmartDoc')"
            ),
            fields="files(id, name, createdTime)",
            orderBy="createdTime desc",
            pageSize=100,
        ).execute()
    except Exception as exc:
        print(f"  could not search for root folders: {exc}")
        return []
    return response.get("files") or []


def _resolve_owning_root(service, folder_id: str, candidate_ids: set[str]) -> str | None:
    """Walk up from a folder until one of the candidate roots is reached."""
    current = folder_id
    for _ in range(12):
        if not current:
            return None
        if current in candidate_ids:
            return current
        try:
            metadata = service.files().get(fileId=current, fields="parents").execute()
        except Exception:
            return None
        parents = metadata.get("parents") or []
        current = parents[0] if parents else None
    return None


def _choose_root(service, profile: dict[str, Any], indexed_folder_ids: list[str]) -> dict[str, str] | None:
    """Pick the root that actually holds this user's indexed files.

    Repeated testing left many workspace roots behind, and a failed setup can point the
    profile at a fresh empty one. The authoritative signal is where the files already are,
    not the stored pointer or creation order.
    """
    candidates = _candidate_roots(service)
    if not candidates:
        return None

    by_id = {item["id"]: item for item in candidates}
    candidate_ids = set(by_id)
    print(f"  {len(candidates)} workspace root(s) exist in Drive")

    counts: dict[str, int] = {}
    for folder_id in indexed_folder_ids:
        owner = _resolve_owning_root(service, folder_id, candidate_ids)
        if owner:
            counts[owner] = counts.get(owner, 0) + 1

    if counts:
        best_id = max(counts, key=lambda key: counts[key])
        print(f"  {counts[best_id]} indexed file(s) live under {by_id[best_id]['name']} ({best_id})")
        return {"id": best_id, "name": by_id[best_id]["name"]}

    stored = profile.get("root_folder_id")
    if stored in candidate_ids:
        print(f"  no indexed files found; keeping stored root {stored}")
        return {"id": stored, "name": by_id[stored]["name"]}

    newest = candidates[0]
    print(f"  no indexed files found; falling back to newest root {newest['name']}")
    return {"id": newest["id"], "name": newest["name"]}


def rebuild_for_profile(profile: dict[str, Any]) -> tuple[dict[str, Any], str] | None:
    service = get_drive_service(profile["google_token"]["refresh_token"])

    indexed = (
        supabase.table("files")
        .select("folder_id")
        .eq("user_id", profile["id"])
        .not_.is_("folder_id", "null")
        .execute()
    ).data or []
    indexed_folder_ids = list({row["folder_id"] for row in indexed if row.get("folder_id")})

    chosen = _choose_root(service, profile, indexed_folder_ids)
    if not chosen:
        print("  no workspace root folder found in Drive")
        return None
    root_id = chosen["id"]
    if root_id != profile.get("root_folder_id"):
        print(f"  correcting root pointer to {chosen['name']} ({root_id})")

    rebuilt: dict[str, Any] = {}
    for subject in _child_folders(service, root_id):
        units = {unit["name"]: unit["id"] for unit in _child_folders(service, subject["id"])}
        rebuilt[subject["name"]] = {"id": subject["id"], "units": units}
    return rebuilt, root_id


def main() -> None:
    parser = argparse.ArgumentParser(description="Rebuild folder_map from Google Drive")
    parser.add_argument("--apply", action="store_true", help="write the rebuilt map to the database")
    arguments = parser.parse_args()
    print(f"mode={'APPLY' if arguments.apply else 'PREVIEW'}")

    # root_folder_id may have been cleared, so it is discovered from Drive when missing.
    profiles = (
        supabase.table("profiles")
        .select("id, status, google_token, folder_map, root_folder_id")
        .not_.is_("google_token", "null")
        .execute()
    ).data or []

    for profile in profiles:
        current = profile.get("folder_map") or {}
        valid_now = sum(
            1 for value in current.values() if isinstance(value, dict) and value.get("id")
        )
        print(f"\nuser {profile['id']}")
        print(f"  status={profile.get('status')} current_entries={len(current)} with_drive_id={valid_now}")

        outcome = rebuild_for_profile(profile)
        if outcome is None:
            continue
        rebuilt, root_id = outcome

        print(f"  rebuilt {len(rebuilt)} subject folder(s) from Drive:")
        for name, data in rebuilt.items():
            unit_names = ", ".join(data["units"].keys()) or "no units"
            print(f"    - {name}: {unit_names}")

        if not arguments.apply:
            continue

        payload: dict[str, Any] = {"folder_map": rebuilt, "root_folder_id": root_id}
        # A user with real folders belongs in the active state; anything else blocks
        # WhatsApp ingestion and forces them back into setup.
        if rebuilt and profile.get("status") != "ACTIVE":
            payload["status"] = "ACTIVE"

        supabase.table("profiles").update(payload).eq("id", profile["id"]).execute()
        print(f"  written (status={payload.get('status', profile.get('status'))})")


if __name__ == "__main__":
    main()
