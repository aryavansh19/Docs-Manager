-- Two columns needed to name files from the sender's caption and to offer a rename.
--
-- 1. ingestion_jobs.caption
--
-- WhatsApp delivers any text typed alongside an attachment as `caption` on the media
-- object. It is the only description of a document that the sender writes by hand, which
-- makes it the best filename available -- better than the image model's guess, and better
-- than "Scan_20260101.pdf". Ingestion runs in a background worker that receives only the
-- job row, so the caption has to be stored here to survive the handoff from the webhook.
--
-- 2. profiles.pending_action
--
-- After a file is saved the bot offers "Rename" / "Looks good" as reply buttons. Tapping
-- Rename arrives as an interactive message, but the name itself arrives afterwards as an
-- ordinary text message, which would otherwise be run as a search query. Nothing in this
-- schema could remember "waiting for a new filename for file X": profiles.status tracks
-- onboarding, and the existing button flows encode their state in the button id, which
-- only works when the reply is itself a button press.
--
-- jsonb rather than a dedicated column pair because this is the first of several such
-- prompts, and a shape like {"type": "rename", "file_id": ..., "at": ...} lets the next
-- one land without another migration. Reads are guarded by a 15 minute TTL in the
-- application, so a stale value cannot hijack a later search.
--
-- Note on privileges: this column is deliberately NOT granted to `authenticated`. The
-- earlier restrict_profile_column_privileges migration enumerated the columns the browser
-- may read at that point in time, precisely so that a new column has to be exposed on
-- purpose. pending_action is backend-only state and the frontend has no reason to see it,
-- so no grant is added here.

alter table public.ingestion_jobs
    add column if not exists caption text;

alter table public.profiles
    add column if not exists pending_action jsonb;
