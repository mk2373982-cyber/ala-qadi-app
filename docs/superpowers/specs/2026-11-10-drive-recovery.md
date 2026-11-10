# Google Drive Recovery Specification

## Goal

Make a customer's local financial data recoverable on a replacement phone through the customer's own Google Drive account, including edits made while offline.

## Product behavior

- IndexedDB on the phone remains the primary data store.
- Drive receives an encrypted current backup and one encrypted previous backup in the app-specific data folder.
- Offline edits set a durable pending marker and upload after connectivity returns while the app is open, or after the customer next opens the app and reconnects Drive.
- The Google access token stays in memory; it is never persisted in browser storage. A user-driven reconnect is required after reload or token expiry.
- A random 128-bit recovery key is shown once when the first encrypted backup is initialized. The customer must acknowledge saving it before the first upload. The key itself is not stored in Drive or browser storage; only a non-extractable CryptoKey is stored locally.
- Restore accepts the current backup, the previous backup, and legacy plaintext backups from the earlier implementation. Restore previews the backup date and confirms before replacing local financial data.
- Successful restore on a new device stores the non-extractable key locally and enables future encrypted backups.
- Upload failures keep the pending marker and expose a clear status. The app retries on online/visibility events with bounded backoff.
- No backup file is permanently deleted automatically.

## Security and recovery constraints

- Encrypt JSON with Web Crypto AES-GCM using a fresh 96-bit IV per upload and authenticated metadata.
- Encode binary fields as base64url and validate the envelope and payload before restore.
- Do not upload raw transaction JSON after encrypted backup initialization.
- Legacy plaintext backups remain readable for compatibility; after restore, the user is guided through encrypted backup setup.
- Losing both the device's local CryptoKey and the one-time recovery key makes encrypted backups unrecoverable. The UI must state this plainly and provide a copy action.

## Verification

- Production build succeeds.
- Desktop browser flow: create backup, change data, current backup updates, previous backup remains restorable, and upload error retains pending status.
- Mobile browser flow: save recovery key, restore current/previous on a clean browser profile, and reject a wrong recovery key without altering local data.
- Offline flow: make an edit offline, verify pending state, reconnect and verify successful upload.
- Legacy flow: restore the existing JSON backup, then initialize encrypted backups.
