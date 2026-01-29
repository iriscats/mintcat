## Cloud Backup Design

### Goals
- Backup the entire local SQLite database to a cloud service.
- Allow users to list, download, and restore backups.
- Keep the client logic simple and resilient to large files.

### Non-goals
- Server-side data reconciliation.
- Incremental or per-table sync (out of scope for v1).

### Data Model
BackupRecord:
- id: string
- createdAt: string (ISO-8601)
- size: number (bytes)
- checksum: string (sha256 hex, optional)
- appVersion: string
- schemaVersion: string (optional)
- deviceId: string (optional)
- note: string (optional)
- userId: string (server derived from auth token)

### REST API (v1)

Base URL: `https://<backup-host>/v1`

#### 1) Create backup (direct upload)
`POST /backups`
- Auth: `Authorization: Bearer <token>`
- Content-Type: `multipart/form-data`
  - `metadata`: JSON string (BackupRecord fields except id)
  - `file`: binary file (SQLite DB)
- Response: `{ backup: BackupRecord }`

#### 2) Create backup (multipart / large file)
`POST /backups/init`
- Auth: Bearer token
- Body (JSON): `{ size, checksum, appVersion, schemaVersion, deviceId, note }`
- Response: `{ uploadId, uploadUrl, headers, backupId }`

Client uploads the file to `uploadUrl` with `headers`, then:

`POST /backups/complete`
- Body: `{ uploadId, backupId, size, checksum }`
- Response: `{ backup: BackupRecord }`

#### 3) List backups
`GET /backups`
- Auth: Bearer token
- Response: `{ items: BackupRecord[] }`

#### 4) Download backup
`GET /backups/{id}/download`
- Auth: Bearer token
- Response:
  - Option A: `{ downloadUrl, expiresAt }` (preferred, signed URL)
  - Option B: binary stream (application/octet-stream)

#### 5) Delete backup
`DELETE /backups/{id}`
- Auth: Bearer token
- Response: `{ success: true }`

### Client Flow (Frontend)

#### Backup
1. Read local DB file from:
   `configDir/com.mint.cat/mintcat.sqlite`
2. Compute metadata (size, checksum, appVersion, timestamp).
3. Upload using direct `POST /backups` (or multipart for large files).
4. Refresh backup list.

#### Restore
1. Request download URL or bytes from `/backups/{id}/download`.
2. Write file to a pending restore path:
   `configDir/com.mint.cat/mintcat.sqlite.restore`
3. Prompt user to restart.
4. On next startup, if `.restore` exists:
   - Move current `mintcat.sqlite` to `mintcat.sqlite.bak`
   - Replace with `.restore` file
   - Remove `.restore`

### Security
- All endpoints require Bearer token auth.
- Server should validate checksum and size.
- Optional client-side encryption can be added (AES-GCM) and stored as metadata flags.

### Error Handling
- Standard JSON error response: `{ errorCode, message }`
- Typical errors: 401 (unauthorized), 413 (payload too large), 422 (invalid metadata).
