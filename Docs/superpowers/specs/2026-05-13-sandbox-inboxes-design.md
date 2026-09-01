# Sandbox Inboxes — Design Spec

**Date**: 2026-05-13
**Status**: Approved

## Overview

Add standalone sandbox inboxes at the user level. Each sandbox gets a user-chosen email address (`prefix@inbox.mocklane.com`), dedicated SMTP credentials, and an isolated email inbox. Sandboxes are independent of workspaces and persist until manually deleted.

## Data Model

### `sandboxes` table

| Column               | Type                  | Constraints                          |
|----------------------|-----------------------|--------------------------------------|
| id                   | UUID                  | PK, default uuid4                    |
| user_id              | UUID                  | FK → users.id, NOT NULL, indexed     |
| name                 | VARCHAR(100)          | NOT NULL                             |
| email_prefix         | VARCHAR(50)           | UNIQUE, NOT NULL, indexed            |
| email_address        | VARCHAR(200)          | UNIQUE, NOT NULL, indexed            |
| smtp_username        | VARCHAR(64)           | UNIQUE, NOT NULL, indexed            |
| smtp_password        | VARCHAR(128)          | NOT NULL                             |
| description          | TEXT                  | nullable                             |
| tags                 | JSONB                 | default []                           |
| is_active            | BOOLEAN               | default true                         |
| email_retention_days | INTEGER               | nullable (null = forever)            |
| created_at           | TIMESTAMP WITH TZ     | server_default=now()                 |
| updated_at           | TIMESTAMP WITH TZ     | server_default=now(), onupdate=now() |

### `sandbox_emails` table

| Column         | Type              | Constraints                               |
|----------------|-------------------|-------------------------------------------|
| id             | UUID              | PK, default uuid4                         |
| sandbox_id     | UUID              | FK → sandboxes.id ON DELETE CASCADE, index |
| message_id     | VARCHAR(500)      | nullable                                  |
| from_address   | VARCHAR(500)      | NOT NULL                                  |
| to_addresses   | JSONB             | NOT NULL, default []                      |
| cc_addresses   | JSONB             | NOT NULL, default []                      |
| bcc_addresses  | JSONB             | NOT NULL, default []                      |
| subject        | VARCHAR(1000)     | nullable                                  |
| text_body      | TEXT              | nullable                                  |
| html_body      | TEXT              | nullable                                  |
| headers        | JSONB             | NOT NULL, default {}                      |
| attachments    | JSONB             | NOT NULL, default []                      |
| raw_size       | INTEGER           | default 0                                 |
| is_read        | BOOLEAN           | default false                             |
| received_at    | TIMESTAMP WITH TZ | server_default=now()                      |

Attachments are stored as JSON with base64-encoded content, capped at 10 MB per attachment.

## API Endpoints

All endpoints require authentication (JWT).

### Sandbox CRUD

- `POST /api/v1/sandboxes` — Create a new sandbox
  - Body: `{ name, email_prefix, description?, tags?, email_retention_days? }`
  - Validates prefix uniqueness and format
  - Auto-generates smtp_username and smtp_password
  - Returns the created sandbox with credentials

- `GET /api/v1/sandboxes` — List current user's sandboxes
  - Returns: list of sandboxes with email count and last received timestamp
  - Supports `?tag=` filter

- `GET /api/v1/sandboxes/{sandbox_id}` — Get sandbox details
  - Ownership check: user_id must match current user

- `PATCH /api/v1/sandboxes/{sandbox_id}` — Update sandbox
  - Mutable fields: name, description, tags, is_active, email_retention_days
  - email_prefix is immutable after creation

- `DELETE /api/v1/sandboxes/{sandbox_id}` — Delete sandbox and all emails
  - CASCADE deletes sandbox_emails

### SMTP Credentials

- `GET /api/v1/sandboxes/{sandbox_id}/credentials` — Show SMTP credentials
  - Returns: smtp_username, smtp_password, smtp_host, smtp_port, email_address

- `POST /api/v1/sandboxes/{sandbox_id}/credentials/regenerate` — Regenerate password
  - Generates new smtp_password, returns updated credentials

### Sandbox Emails

- `GET /api/v1/sandboxes/{sandbox_id}/emails` — List emails (paginated)
  - Query params: `?page=1&per_page=20&search=`
  - Returns: paginated list, sorted by received_at DESC

- `GET /api/v1/sandboxes/{sandbox_id}/emails/{email_id}` — Get full email
  - Includes: all headers, text/html body, attachments metadata

- `PATCH /api/v1/sandboxes/{sandbox_id}/emails/{email_id}` — Mark read/unread
  - Body: `{ is_read: boolean }`

- `DELETE /api/v1/sandboxes/{sandbox_id}/emails/{email_id}` — Delete single email

- `DELETE /api/v1/sandboxes/{sandbox_id}/emails` — Clear all emails in sandbox

### Prefix Validation

- `GET /api/v1/sandboxes/check-prefix/{prefix}` — Check availability
  - Returns: `{ available: boolean, suggestion?: string }`

## Email Prefix Validation Rules

- 3 to 50 characters
- Lowercase letters, numbers, and hyphens only
- Must start with a letter
- Cannot end with a hyphen
- No consecutive hyphens
- Reserved words blocked: `admin`, `postmaster`, `abuse`, `noreply`, `support`, `test`, `info`, `help`, `billing`, `sales`

## SMTP Server Changes

The `MockLaneAuthenticator` in `smtp_server.py` currently checks only `workspaces.smtp_username`. Updated flow:

1. Receive LOGIN auth with username/password
2. Query `workspaces` table for matching smtp_username
3. If found and password matches → set `session.workspace_id`, return success
4. If not found → query `sandboxes` table for matching smtp_username
5. If found, password matches, and `is_active=True` → set `session.sandbox_id`, return success
6. Otherwise → return auth failure

The `MockLaneSMTPHandler.handle_DATA` updated flow:

1. Check for `workspace_id` on session → store in `inbox_emails` (existing behavior)
2. Check for `sandbox_id` on session → store in `sandbox_emails` (new behavior)
3. Neither → return 550

Both paths use the same email parsing logic (extracted into a shared helper).

## Frontend Pages

### `/dashboard/sandboxes` — Sandbox List

- Grid/list of user's sandboxes
- Each card shows: name, email address, tags, email count, last received, active/inactive badge
- "Create Sandbox" button
- Filter by tag
- Quick actions: copy email address, toggle active/inactive

### `/dashboard/sandboxes/new` — Create Sandbox

- Form fields: name, email prefix (with live `check-prefix` call), description, tags (multi-select or free-form), retention days
- Preview of full email address as user types prefix
- Submit creates sandbox and redirects to inbox view

### `/dashboard/sandboxes/[id]` — Sandbox Inbox

- Reuses the inbox UI pattern from workspace inbox page
- Left panel: email list with sender, subject, time, read/unread
- Right panel: email detail with HTML Preview, Plain Text, Headers tabs
- Sidebar or top section: SMTP credentials (show/copy), sandbox settings
- Actions: mark read/unread, delete email, clear all, delete sandbox

## Navigation

Add "Sandboxes" link to the dashboard sidebar/nav, alongside existing workspace navigation. Sandboxes are a top-level feature, not nested under workspaces.

## Future Considerations (Not in this spec)

- Plan-based limits on number of sandboxes and emails per month
- Email retention enforcement via background job
- Webhook notifications when sandbox receives email
- API key auth (non-SMTP) for programmatic access
- Sandbox sharing between team members
