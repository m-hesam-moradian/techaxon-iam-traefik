# Techaxon IAM

Techaxon IAM is a NestJS-based authentication and identity API backed by CouchDB. It provides user registration, email verification, JWT authentication, session management, and protected user profile access.

## Table of Contents
 
- [Features](#features)
- [API Endpoints](#api-endpoints)
- [Tech Stack](#tech-stack)
- [Architecture & Project Structure](#architecture--project-structure)
- [Getting Started](#getting-started)
- [Installation](#installation)
- [Running the Application](#running-the-application)
- [Available Scripts](#available-scripts)
- [Environment Variables](#environment-variables)
- [Authentication Flow](#authentication-flow)
- [Testing](#testing)
- [API Examples](#api-examples)
---

## Features

- User registration with email, password, and optional username
- BCrypt password hashing
- Atomic email reservation using CouchDB email claim documents
- JWT-based email verification
- Login restricted to verified and active users
- JWT access and refresh token authentication
- CouchDB-backed sessions with hashed refresh tokens
- Protected user profile endpoint using Bearer access tokens
- Session revocation on logout
- Revoked sessions cannot access protected routes or refresh tokens
- Automatic CouchDB index migrations on application startup

### Database Indexes

The application creates and manages CouchDB indexes for:

- User email lookup
- Session user ID lookup
- Session refresh-token hash lookup
- Session expiration lookup

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | Health check endpoint |
| POST | `/auth/register` | Register a new user |
| GET | `/auth/verify-email?token=...` | Verify user email |
| POST | `/auth/login` | Authenticate user and create a session |
| GET | `/auth/me` | Get authenticated user profile |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/logout` | Revoke current session |

---

## Tech Stack

- **Language:** TypeScript
- **Runtime:** Node.js
- **Framework:** NestJS 11
- **HTTP Adapter:** Express (`@nestjs/platform-express`)
- **Database:** CouchDB
- **CouchDB Client:** nano
- **Authentication:**
  - `@nestjs/jwt`
  - `jsonwebtoken`
  - Passport JWT
- **Password Hashing:** bcryptjs
- **Validation:**
  - class-validator
  - class-transformer
- **Package Manager:** pnpm (`pnpm@11.18.0`)
- **Testing:**
  - Jest
  - Supertest
- **Code Quality:**
  - ESLint
  - Prettier

---

## Architecture & Project Structure

The project follows a modular NestJS architecture with a controller → service → repository layering approach:

```
HTTP Request
      |
      v
AuthController
      |
      v
AuthService / TokenService / SessionService
      |
      v
Repository Abstractions
      |
      v
CouchDB Implementations
      |
      v
CouchDB Documents
```
This maps directly onto the folder structure:

```
src/
├── auth/                    # AuthModule — endpoints, JWT strategies, token generation/validation, guards
├── users/                   # UsersModule — user repository abstraction and CouchDB implementation
├── sessions/                # SessionModule — session creation, refresh token storage, validation, revocation
├── infrastructure/
│   └── couchdb/             # CouchDBModule — connection setup, document models, migrations
├── app.module.ts            # Root application module
└── main.ts                  # Application bootstrap
 
docs/
└── api/                     # API request examples
 
test/                        # End-to-end tests
 
*.spec.ts                    # Unit tests
 
.env.example                 # Environment configuration example
 
package.json                 # Dependencies and scripts
```

---

## Getting Started

### Prerequisites

Make sure you have:

- Node.js installed
- pnpm installed
- A running CouchDB instance

The application expects the CouchDB database defined by `COUCHDB_DATABASE` to already exist.

> The application creates required indexes during startup but does not create the database itself.

---

## Installation

Install dependencies:

```bash
pnpm install
```

Create a `.env` file using `.env.example` as a reference:

```bash
cp .env.example .env
```

Configure your CouchDB connection and JWT settings.

---

## Running the Application

### Development mode

```bash
pnpm start:dev
```

The server runs on:

```
http://localhost:3000
```

unless another port is configured using the `PORT` environment variable.

### Production build

Build the application:

```bash
pnpm build
```

Start the production server:

```bash
pnpm start:prod
```

---

## Available Scripts

| Command | Description |
|---|---|
| `pnpm start:dev` | Start development server with watch mode |
| `pnpm build` | Build production application |
| `pnpm start:prod` | Run production build |
| `pnpm test` | Run unit tests |
| `pnpm test:e2e` | Run end-to-end tests |
| `pnpm test:cov` | Run tests with coverage |
| `pnpm lint` | Run ESLint |

---

## Environment Variables

### CouchDB

```env
COUCHDB_URL=
COUCHDB_DATABASE=
```

### JWT Configuration

```env
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_VERIFICATION_SECRET=

JWT_ACCESS_EXPIRES_IN=
JWT_REFRESH_EXPIRES_IN=
JWT_VERIFICATION_EXPIRES_IN=

JWT_ISSUER=
JWT_AUDIENCE=
```

### Server

```env
PORT=3000
```

---

## Authentication Flow

### Registration

1. User submits email, password, and optional username.
2. Password is hashed using BCrypt.
3. Email ownership is reserved atomically in CouchDB.
4. A verification JWT is generated.
5. The user verifies their email using the verification token.

### Login

1. User submits verified credentials.
2. Credentials are validated.
3. Access and refresh JWTs are generated.
4. Refresh token information is stored as a hashed session record in CouchDB.

### Authenticated Requests

Protected routes require a Bearer access token:

```http
Authorization: Bearer <access_token>
```

### Logout

Logging out revokes the current session.

Revoked sessions cannot:

- Access protected routes
- Refresh access tokens

---

## Testing

Run unit tests:

```bash
pnpm test
```

Run end-to-end tests:

```bash
pnpm test:e2e
```

Generate test coverage:

```bash
pnpm test:cov
```

---

## API Examples

HTTP request examples for the authentication flow are available in:

```
docs/api/
```