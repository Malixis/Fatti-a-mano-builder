# Security Specification — Fatti a mano (Lab & Design ERP)

## 1. Data Invariants

1. **Zero Blanket Access**: Every collection defaults to deny (`allow read, write: if false;`).
2. **Ownership & Verified Identity**: Only signed-in users with `request.auth.token.email_verified == true` can create, read, update, or delete their own documents (`ownerId == request.auth.uid`).
3. **Immutable Ownership & Creation Time**: `ownerId` and `createdAt` can never be mutated during `update`.
4. **Server Timestamps**: `createdAt` on `create` and `updatedAt` on both `create` and `update` must strictly equal `request.time`.
5. **Bounded Arrays & Strings**: `materials` is bounded to `<= 50` items; `elements` is bounded to `<= 80` items; all string fields enforce explicit `.size()` bounds matching `firebase-blueprint.json`.
6. **Path ID Hardening**: All single-document operations (`get`, `create`, `update`, `delete`) validate `isValidId(docId)` (`^[a-zA-Z0-9_\-]+$`, max 128 chars).

## 2. The "Dirty Dozen" Payloads

1. **Unauthenticated Write**: `auth = null`, creating a workshop in `/workshops/w1` -> `PERMISSION_DENIED`.
2. **Unverified Email Spoof**: `auth = { uid: 'u1', token: { email_verified: false } }`, creating a workshop -> `PERMISSION_DENIED`.
3. **Identity Spoofing on Create**: `auth.uid = 'u1'`, payload sets `ownerId: 'u2'` -> `PERMISSION_DENIED`.
4. **Shadow Field Injection on Create**: Payload includes extra key `isAdmin: true` not in `hasOnly()` -> `PERMISSION_DENIED`.
5. **Shadow Field Injection on Update**: Update payload modifies an unapproved key or adds `hacked: 1` -> `PERMISSION_DENIED`.
6. **Owner Hijack on Update**: User `u1` attempts to change `ownerId` from `'u1'` to `'u2'` -> `PERMISSION_DENIED`.
7. **Timestamp Forgery**: Client passes a past or future `createdAt` or `updatedAt` instead of `request.time` -> `PERMISSION_DENIED`.
8. **CreatedAt Mutation**: Update attempts to alter `createdAt` -> `PERMISSION_DENIED`.
9. **Resource Poisoning (Oversized String)**: `title` exceeds 120 characters or `phase1Setup` exceeds 3000 characters -> `PERMISSION_DENIED`.
10. **Array Overflow Attack**: `materials` list has 51 items (`> 50`) or `elements` has 81 items (`> 80`) -> `PERMISSION_DENIED`.
11. **ID Poisoning Attack**: Document ID contains spaces or special characters (`w$1/bad`) or exceeds 128 chars -> `PERMISSION_DENIED`.
12. **Cross-Tenant List Scraping**: Authenticated user `u1` queries `/workshops` without filtering `where('ownerId', '==', 'u1')` -> `PERMISSION_DENIED`.
