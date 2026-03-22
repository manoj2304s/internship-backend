# Database Schema Explanation

## 1. User Entity

Collection: `users`

Fields:

- `name`: string
- `email`: string, unique
- `phone`: string, unique
- `password`: string, bcrypt hashed
- `role`: `user | admin | super_admin`
- `isVerified`: boolean
- `passwordResetToken`: string or null
- `passwordResetExpiresAt`: date or null
- `createdAt`: date
- `updatedAt`: date

Purpose:

- Stores the primary identity and authorization data for each account.

## 2. OTP Entity

Collection: `otps`

Fields:

- `user`: ObjectId reference to `users`
- `code`: string
- `purpose`: `verification | login`
- `channel`: `email | phone`
- `expiresAt`: date
- `attempts`: number
- `maxAttempts`: number
- `createdAt`: date
- `updatedAt`: date

Purpose:

- Stores one-time passwords separately from the user record.
- Supports expiry validation.
- Supports attempt-limiting to reduce brute-force guessing.

## 3. Refresh Token Entity

Collection: `refreshtokens`

Fields:

- `user`: ObjectId reference to `users`
- `token`: string, unique
- `expiresAt`: date
- `isRevoked`: boolean
- `createdAt`: date
- `updatedAt`: date

Purpose:

- Stores refresh tokens independently for secure token rotation.
- Allows logout and password reset to revoke active sessions.

## Relationship Summary

- One `User` can have many `OTP` records over time.
- One `User` can have many `RefreshToken` records over time.
- OTPs are short-lived and deleted after successful verification.
- Refresh tokens are rotated and revoked instead of being trusted forever.
