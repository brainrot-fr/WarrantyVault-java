# Optional Railway deployment

The local profile is the primary way to run WarrantyVault. Railway is an optional one-service demo deployment: a single Spring Boot service uses MySQL and also serves the built React frontend.

## 1. Create a Railway project

Create a project in Railway and connect this Git repository. Keep the repository root as the build context so the Dockerfile can build both `frontend/` and `backend/`.

## 2. Add MySQL

Add a Railway MySQL plugin to the project, or connect another MySQL database reachable by the service. Create the JDBC URL using that database's host, port, and database name, for example:

```text
jdbc:mysql://<host>:<port>/<database>?useSSL=true
```

Use the MySQL plugin's username and password. The application applies its portable Flyway migrations at startup.

## 3. Deploy the backend service

Deploy the repository as a Docker service. [`railway.toml`](./railway.toml) selects `backend/Dockerfile`; its build stages compile the Vite frontend, copy `frontend/dist` into the Spring Boot static resources, and package the backend. The runtime starts Spring Boot with the `prod` profile and listens on Railway's `PORT`.

## 4. Configure variables

Set these variables on the backend service:

| Variable | Required value |
| --- | --- |
| `SPRING_PROFILES_ACTIVE` | `prod` |
| `DB_URL` | MySQL JDBC URL, such as `jdbc:mysql://<host>:<port>/<database>?useSSL=true` |
| `DB_USER` | MySQL username |
| `DB_PASSWORD` | MySQL password |
| `JWT_SECRET` | A private random value of at least 32 UTF-8 bytes; do not use the local development value |
| `CORS_ALLOWED_ORIGINS` | The exact public origin of this same service, for example `https://your-service.up.railway.app` |

The app fails fast in `prod` when any required variable is missing or invalid. `APP_STORAGE_LOCAL_DIR` optionally overrides the default `/app/uploads` image directory. `COOKIE_SAMESITE` defaults to `Lax`; `COOKIE_DOMAIN` is optional. `APP_BASE_URL` is not needed because invitations are handled in-app and the frontend and API share one origin.

Warranty status uses `app.expiring-soon-days` and defaults to 30 days. Override it with the Spring environment variable `APP_EXPIRING_SOON_DAYS` if the deployment needs a different dashboard attention window.

The baseline Flyway migration is intentionally kept portable for fresh H2 and MySQL databases. If deploying over a database created by an older WarrantyVault build, take a backup and review its Flyway history before startup; changing an already-applied baseline requires the normal Flyway repair/rebaseline procedure for that environment.

## 5. Frontend delivery

The Docker build includes the production Vite output in the Spring Boot jar. Spring serves the frontend and API from the same Railway service and origin; no separate frontend host or API base URL is required. Client-side application routes are forwarded to the frontend entry point.

## 6. Image persistence

Images are stored on the service's local filesystem, not in MySQL or an external object store. Railway free instances use an **ephemeral filesystem**: uploaded images can disappear after a redeploy or restart. This is acceptable for a demo/interview deployment, but retain original receipts and warranty documents elsewhere.

## 7. Optional custom domain

Add a custom domain in the Railway service's domain settings and configure the requested DNS records with your DNS provider. Update `CORS_ALLOWED_ORIGINS` to the exact custom-domain origin (scheme included, without a trailing path), then redeploy. The application remains served from that same origin.
