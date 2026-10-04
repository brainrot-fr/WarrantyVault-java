# WarrantyVault

WarrantyVault keeps product details, receipts, and warranty dates together. Create Spaces for a home or team, then share them with owners, editors, and viewers.

## What it does

- Record products, purchase dates, coverage periods, prices, and notes.
- Upload private bills and optional warranty-card images.
- Find coverage that is active, expiring soon, or expired.
- Invite people to a Space and manage their access.

## Built with

- Java 21 and Spring Boot for the application and API.
- HTML, CSS, and browser JavaScript modules for the web interface.
- H2 with Flyway for local development; MySQL with Flyway for deployment.
- JWT access tokens with rotating, same-origin refresh cookies.
- Local filesystem storage for uploaded images.

## Run locally

Install Java 21, then run:

```sh
make run
```

Open <http://localhost:8080>. The local profile uses a file-backed H2 database and stores uploads under `server/uploads/`. See [LOCAL.md](./LOCAL.md) for demo accounts, test commands, and local-data details.

## Deploy to Railway

The repository includes `railway.toml` and a Dockerfile under `server/`. Railway builds one Java service that serves both the UI and API. Configure the production database and secret environment variables in Railway before deploying.

Uploaded images use the application filesystem. Railway instances may have ephemeral storage, so configure persistent storage or keep a separate copy of important documents.
