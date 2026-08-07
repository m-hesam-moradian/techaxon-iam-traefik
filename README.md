# TechAxon Local Infrastructure

Local development infrastructure for the TechAxon platform.

This project provides the shared infrastructure required to run TechAxon services locally, including **Traefik as a reverse proxy, local HTTPS certificates, and shared service routing**.

## Features

- Traefik v3.7 reverse proxy
- Local HTTPS with `mkcert`
- Automatic local certificate generation
- HTTPS routing for TechAxon applications
- Traefik Dashboard
- CouchDB
- Redis
- Local development support for multiple applications
- Centralized routing through `traefik_dynamic.yml`

## Architecture

```text
                         ┌─────────────────────────┐
                         │        Browser          │
                         └────────────┬────────────┘
                                      │ HTTPS
                                      ▼
                         ┌─────────────────────────┐
                         │       Traefik v3.7      │
                         │        :80 / :443       │
                         └────────────┬────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
                    ▼                 ▼                 ▼
          idp.techaxon.localhost  lms.techaxon.localhost  dashboard.techaxon.localhost
                    │                 │                 │
                    ▼                 ▼                 ▼
                NestJS IAM         Next.js           Traefik
                  :3000              :3001            Dashboard
```

## Requirements

Make sure the following are installed:

- Docker
- Docker Compose
- Node.js
- pnpm
- VS Code

## Run

From the project root:

```bash
pnpm dev
```

This starts the local infrastructure and generates the required development certificates if they do not already exist.

## Development

The repository includes a VS Code multi-root workspace for working with the IAM and LMS applications together.

Open the workspace with:

```bash
code techaxon.code-workspace
```

This allows the individual application settings, TypeScript configuration, formatting, and development tooling to work correctly while keeping the projects in a single VS Code window.

## Local Applications

Once the infrastructure is running, the following applications are available:

| Application | URL |
|---|---|
| IAM / Identity Provider | https://idp.techaxon.localhost |
| LMS / Frontend | https://lms.techaxon.localhost |
| Traefik Dashboard | https://dashboard.techaxon.localhost |

### Traefik Dashboard

```text
Username: admin
Password: password
```

> The default dashboard credentials are intended for local development only. Do not use these credentials in production.

## Local HTTPS Certificates

The project uses [`mkcert`](https://github.com/FiloSottile/mkcert) to generate locally trusted development certificates.

Certificates are generated automatically by the `certs-generator` container and stored in:

```text
certs_data/
├── rootCA.pem
├── techaxon.localhost.pem
└── techaxon.localhost-key.pem
```

The generated certificate covers the TechAxon local domains, including:

```text
*.techaxon.localhost
techaxon.localhost
```

### Windows: Trust the Local Root CA

If Chrome or another browser shows a red HTTPS warning for the local applications, import the generated Root CA into the Windows trusted root certificate store.

Open **PowerShell as Administrator** from the project root and run:

```powershell
Import-Certificate `
  -FilePath ".\certs_data\rootCA.pem" `
  -CertStoreLocation Cert:\LocalMachine\Root
```

After importing the certificate, **close and reopen your browser**.

Then open:

```text
https://idp.techaxon.localhost
```

or

```text
https://lms.techaxon.localhost
```

### macOS

On macOS, install `mkcert` and trust its local CA:

```bash
brew install mkcert
mkcert -install
```

After that, restart the browser.

## Traefik Configuration

Traefik uses the **File Provider** for local routing.

The main configuration is located at:

```text
traefik/
└── traefik_dynamic.yml
```

The configuration contains:

- TLS certificates
- HTTP routers
- Services
- Basic Authentication
- Rate limiting
- Internal Traefik Dashboard routing

Example:

```yaml
http:
  routers:
    iam-router:
      rule: "Host(`idp.techaxon.localhost`)"
      entryPoints:
        - websecure
      tls: true
      service: iam-service
```

The IAM and LMS applications run directly on the host machine while Traefik runs inside Docker. Traefik reaches the host applications through:

```text
host.docker.internal
```

## Project Structure

```text
techaxon-iam-traefik/
├── certs_data/
│   ├── rootCA.pem
│   ├── techaxon.localhost.pem
│   └── techaxon.localhost-key.pem
│
├── traefik/
│   └── traefik_dynamic.yml
│
├── docker-compose.yml
├── package.json
├── pnpm-lock.yaml
└── techaxon.code-workspace
```

## Useful Commands

Start the infrastructure:

```bash
pnpm dev
```

Stop the infrastructure:

```bash
docker compose down
```

View Traefik logs:

```bash
docker logs -f techaxon_traefik
```

Check running containers:

```bash
docker compose ps
```

Restart Traefik:

```bash
docker compose restart traefik
```

## Development Notes

This repository is intended for **local development**.

The following values are development-only:

- Local `mkcert` certificates
- Dashboard credentials
- CouchDB credentials
- Redis configuration
- Local hostnames under `*.techaxon.localhost`

Production deployments should use dedicated certificates, credentials, secrets, domains, and infrastructure configuration.
