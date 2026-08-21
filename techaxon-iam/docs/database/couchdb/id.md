# db
Document	_id
User	user:${uuidv7()}
Session	session:${uuidv7()}
Verification Token	verification-token:${uuidv7()}
Audit	audit:${uuidv7()}
Migration	migration:${name} یا migration:${version}
Email Claim	email:${normalizedEmail}

user:01987d8c-a54c-74af-89fa-6a3e31dcb1b2
session:01987d8d-4d7e-74fa-a8a0-d18d82bb2d93
verification-token:01987d8e-6bc1-7b32-b6c2-6f0d1d5fd5ab
audit:01987d8f-0ef9-75aa-95e4-4c59e16cbcd1

# jwt
Access

{
  "sub": "user:...",
  "sid": "session:...",
  "type": "access"
}

Refresh

{
  "sub": "user:...",
  "sid": "session:...",
  "type": "refresh"
}

Verification

{
  "sub": "user:...",
  "type": "verification"
}

Suppose the user logs out or you rotate the Refresh Token. If you only have the sub (user ID) in the JWT, you can't figure out which Session this token belongs to.

But when you also have the sid:

sid = session:01987d8d-4d7e-74fa-a8a0-d18d82bb2d93

You can directly find the same Session in CouchDB, check its status (e.g. active or revoked) and invalidate it if needed.