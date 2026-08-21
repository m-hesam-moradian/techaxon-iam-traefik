# CouchDB Indexing Strategy

This document details the indexing strategy used in our central database (`techaxon_core`) to support the Auth flow (Register, Login, Refresh, Logout, and Logout All Devices).

## Mango JSON Indexes

We use Mango JSON Indexes (`db.find`) for fields requiring exact matches, resulting in fast `O(log N)` lookup speeds.

The application automatically checks and creates these 6 essential indexes using our migration runner:

1. **`idx_user_email`**: Index on fields `["type", "email"]`
   - Purpose: Used for Login and Register email lookups.

2. **`idx_claim_email`**: Index on fields `["type", "email", "status"]`
   - Purpose: Used to query and verify email claims.

3. **`idx_session_user`**: Index on fields `["type", "userId", "status"]`
   - Purpose: Facilitates "Logout All Devices" and `findByUserId` lookups for active sessions.

4. **`idx_session_cleanup`**: Index on fields `["type", "status", "expiresAt"]`
   - Purpose: Helps identify and clean up expired sessions automatically.

5. **`idx_verification_token`**: Index on fields `["type", "token", "status"]`
   - Purpose: Used for email verification link handling.

6. **`idx_auth_code_lookup`**: Index on fields `["type", "code", "used"]` (ddoc: `iam_auth_codes`)
   - Purpose: Used by `CouchDbAuthCodeRepository.findByCode()` during OIDC Authorization Code exchange. Ensures fast lookup of short-lived, single-use auth codes.

### Manual Index Creation (cURL)

If you need to create these indexes manually (e.g., in a new environment without running migrations), you can use the following `curl` commands. Replace `<DB_URL>` with your CouchDB URL (e.g., `http://admin:password@localhost:5984/techaxon_core`).

#### 1. `idx_user_email`
```bash
curl -X POST <DB_URL>/_index \
  -H "Content-Type: application/json" \
  -d '{
    "index": {"fields": ["type", "email"]},
    "name": "idx_user_email",
    "ddoc": "iam_users",
    "type": "json"
  }'
```

#### 2. `idx_claim_email`
```bash
curl -X POST <DB_URL>/_index \
  -H "Content-Type: application/json" \
  -d '{
    "index": {"fields": ["type", "email", "status"]},
    "name": "idx_claim_email",
    "ddoc": "iam_claims",
    "type": "json"
  }'
```

#### 3. `idx_session_user`
```bash
curl -X POST <DB_URL>/_index \
  -H "Content-Type: application/json" \
  -d '{
    "index": {"fields": ["type", "userId", "status"]},
    "name": "idx_session_user",
    "ddoc": "iam_sessions",
    "type": "json"
  }'
```

#### 4. `idx_session_cleanup`
```bash
curl -X POST <DB_URL>/_index \
  -H "Content-Type: application/json" \
  -d '{
    "index": {"fields": ["type", "status", "expiresAt"]},
    "name": "idx_session_cleanup",
    "ddoc": "iam_sessions",
    "type": "json"
  }'
```

#### 5. `idx_verification_token`
```bash
curl -X POST <DB_URL>/_index \
  -H "Content-Type: application/json" \
  -d '{
    "index": {"fields": ["type", "token", "status"]},
    "name": "idx_verification_token",
    "ddoc": "iam_tokens",
    "type": "json"
  }'
```

#### 6. `idx_auth_code_lookup`
```bash
curl -X POST <DB_URL>/_index \
  -H "Content-Type: application/json" \
  -d '{
    "index": {"fields": ["type", "code", "used"]},
    "name": "idx_auth_code_lookup",
    "ddoc": "iam_auth_codes",
    "type": "json"
  }'
```

## Full-Text Search (Apache Lucene/Clouseau)

Full-Text Search (using Apache Lucene/Clouseau) is purposely deferred. While highly useful for partial match queries and content-heavy modules (like LMS course searches), it isn't necessary for the Auth flow, which relies on strict, exact-value queries for security and performance.
