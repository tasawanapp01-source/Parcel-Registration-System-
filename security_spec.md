# Security Specification: Student Parcel Management & Tracking System

## 1. Data Invariants
1. **Global Deny-by-Default**: Every path not explicitly matched in `/students/{studentId}`, `/parcels/{parcelId}`, or `/admins/{adminId}` is unconditionally denied.
2. **Bound Workspace & Verified Identity**: All operations require either the bound school workspace owner (`ownerId == 'tasawan_app01_pcccr_ac_th'` for `Tasawan_app01@pcccr.ac.th`) or an authenticated verified user (`request.auth != null && request.auth.token.email_verified == true`).
3. **Strict Ownership & Admin RBAC**:
   - `ownerId` on creation MUST strictly equal `'tasawan_app01_pcccr_ac_th'` or `request.auth.uid`.
   - `ownerId` and `studentCode` are validated across all updates.
   - `list` queries MUST filter by `resource.data.ownerId == 'tasawan_app01_pcccr_ac_th'` or `resource.data.ownerId == request.auth.uid` (or bootstrapped verified admin email `tasawan_app01@pcccr.ac.th`) without executing any `get()` or `exists()` calls inside `allow list`.
4. **Schema & Boundary Integrity**:
   - Every string field enforces both `is string` and explicit `.size()` min/max bounds matching `firebase-blueprint.json`.
   - Document IDs (`studentId`, `parcelId`) enforce `isValidId()` (`^[a-zA-Z0-9_\-]+$`, max 128 chars) on single-document operations (`get`, `create`, `update`, `delete`).
   - Enumerated fields (`category`, `status`) only accept values from the strict allowlist.
5. **Terminal State Locking**:
   - Once a parcel reaches `status == 'ส่งมอบสำเร็จ'`, non-admin users cannot mutate the document further.
6. **Temporal Integrity**:
   - `createdAt == request.time` on `create`.
   - `updatedAt == request.time` on `create` and `update`.

## 2. The "Dirty Dozen" Payloads

1. **Unauthenticated Write**: Creating a parcel with `request.auth == null`.
2. **Unverified Email Spoof**: Authenticated user with `email: 'tasawan_app01@pcccr.ac.th'` but `email_verified: false`.
3. **Identity Spoofing on Create**: Creating a student record where `ownerId != request.auth.uid`.
4. **Shadow Field Injection on Create**: Creating a parcel with an undeclared field `"isAdminOverride": true`.
5. **Shadow Field Injection on Update**: Updating a parcel with an undeclared field `"bypassInspection": true`.
6. **Immortal Field Mutation**: Updating `createdAt` or `ownerId` or `studentCode` on an existing document.
7. **Terminal State Reversal**: Updating a parcel whose existing `status` is `'ส่งมอบสำเร็จ'` as a non-admin user.
8. **Invalid Enum Injection**: Setting parcel `status` to `'DELETED_BY_HACKER'`.
9. **Denial-of-Wallet Oversized String**: Injecting a 5,000-character string into `note` (max 300) or `trackingNumber` (max 64).
10. **ID Poisoning Attack**: Creating a document with ID containing spaces or special characters (`../admin`).
11. **Timestamp Forgery**: Providing a past/future client timestamp where `updatedAt != request.time`.
12. **Blanket List Scraping**: Executing an unfiltered `list` query on `/parcels` as a non-owner user.
