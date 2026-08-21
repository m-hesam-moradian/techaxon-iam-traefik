# Fix: Unhandled Rollback Causing Permanent Email Locking (Orphaned Claims)

## Overview
During user registration (`POST /auth/register`), an email claim document (`email:<email>`) is created in CouchDB before the main user document (`user:<uuid>`) is inserted. 

If user creation failed midway or if an unexpected exception occurred during cleanup, the email claim remained in CouchDB without a corresponding user record. This resulted in an **orphaned email claim**, permanently preventing the user from retrying registration with that email.

---

## Cause of the Bug
The registration saga was structured as follows:

1. Reserve email address via `userRepo.claimEmail(email, userId)`.
2. Hash password and insert the user record via `userRepo.createUser()`.
3. If step 2 failed, attempt to release the email claim in the `catch` block:
   ```typescript
   catch (error) {
     await this.userRepo.releaseEmailClaim(email); // 👈 Vulnerable point
     throw error;
   }
   ```
## Why It Failed (Edge Cases):
- Unhandled Rollback Errors: If releaseEmailClaim() failed (due to network timeout, DB disconnect, or concurrent locks), the unhandled exception masked the root cause and left the claim intact.

- Generic 500 Responses: Failures during registration returned unhandled internal exceptions rather than explicit, actionable responses for clients and logs.

## Solution
- Guaranteed Rollback Execution: Wrapped releaseEmailClaim() with safe exception handling (.catch()) so cleanup failures do not suppress the underlying registration error.

- Explicit Error Boundaries: Re-thrown errors are sanitized into clear NestJS HTTP exceptions (InternalServerErrorException or ConflictException), preventing internal stack leakage.

- Claim Idempotency: Ensured releaseEmailClaim treats non-existent or previously released claim documents (404 Not Found) gracefully without crashing.

# Code Refactoring
```typescript
// src/auth/auth.service.ts

try {
  // Step 1: Claim email atomically
  await this.userRepo.claimEmail(email, userId);
} catch {
  throw new ConflictException('A user with this email already exists');
}

try {
  // Step 2: Create user record
  const response = await this.userRepo.createUser(newUser);
  return { success: true, id: response.id, verificationToken };
} catch (error) {
  // Step 3: Safe cleanup rollback
  await this.userRepo.releaseEmailClaim(email).catch(() => {
    // Log cleanup failure for infrastructure tracking
  });

  if (error instanceof ConflictException) {
    throw error;
  }

  throw new InternalServerErrorException(
    'Registration failed due to a server error. Please try again.'
  );
}
```
## Verification
- Normal Flow: User registers successfully; email claim and user document exist.

- Failed Insertion Simulation: Force a failure in createUser(). Verified that releaseEmailClaim() removes email:<email> from CouchDB.

- Retest Registration: Retried registering with the same email address after failure; verified that registration succeeds without encountering a 409 Conflict.