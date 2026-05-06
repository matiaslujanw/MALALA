# Supabase Keepalive

This repository includes a minimal external keepalive for Supabase Free projects so the database is not paused after long inactivity windows.

## What was added

- `C:\repos\MALALA\supabase\migrations\202605060001_supabase_keepalive.sql`
  - creates schema `api` if missing
  - creates `api.supabase_keepalive`
  - creates RPC function `api.keepalive()`
- `C:\repos\MALALA\.github\workflows\supabase-keepalive.yml`
  - calls the dedicated Supabase RPC twice per day

The keepalive does not query business tables. It only upserts a single fixed row in `api.supabase_keepalive` and returns a small JSON payload.

## Why the function uses `security definer`

The scheduled job uses the public project URL and anon key. To keep that safe, the migration grants execute access only to `api.keepalive()` and does not grant direct access to `api.supabase_keepalive`.

This keeps the mechanism reusable across repositories without exposing unrelated data or requiring application-specific credentials.

## Required GitHub Actions secrets

- `SUPABASE_PROJECT_URL`
  - example: `https://your-project-ref.supabase.co`
- `SUPABASE_ANON_KEY`

## One-time Supabase setup

Apply the migration in `C:\repos\MALALA\supabase\migrations\202605060001_supabase_keepalive.sql`.

Also confirm that schema `api` is included in Supabase REST exposed schemas, because the workflow calls the RPC through the REST endpoint using `Accept-Profile: api`.

## Manual test

You can test the RPC manually with:

```bash
curl -X POST \
  "$SUPABASE_PROJECT_URL/rest/v1/rpc/keepalive" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Accept: application/json" \
  -H "Accept-Profile: api" \
  -H "Content-Profile: api" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected response:

```json
{"ok":true,"timestamp":"2026-05-06T12:34:56.789Z"}
```

You can also trigger the workflow manually from GitHub Actions with `workflow_dispatch`.

## Adjusting or disabling the schedule

Edit `C:\repos\MALALA\.github\workflows\supabase-keepalive.yml`:

- change the `cron` entries to run less or more often
- remove the `schedule` block entirely to disable automatic keepalive
- keep `workflow_dispatch` if you still want manual runs

The current schedule runs twice per day, which is safely within the 48-hour inactivity window.
