# WarrantyVault on Railway

**Official documentation checked: 2026-10-06.** This guide checked the current Railway Dockerfile, variables/reference, deployments, GitHub integration, and healthcheck documentation, and Cloudinary upload/media-access-control documentation. Railway and Cloudinary occasionally rename menus; if a label differs, use the current official docs and look for the equivalent GitHub access, Variables, Deploy, Healthcheck, or API credentials screen.

This deployment uses a **new Railway project** with one GitHub-connected app service (the jar also serves the vanilla frontend), one new Railway MySQL service, and Cloudinary authenticated image assets. The old Railway project remains the migration source until the new project passes verification. The browser never receives a Cloudinary URL. `ProductController` remains the authenticated image stream.

## 1. Create the new Railway project and connect GitHub

1. In Railway, choose **New Project** (or **Create Project**) and enter `<NEW_RAILWAY_PROJECT_NAME>`. Do not reuse or delete the old project yet.
2. Open Railway account settings, **Integrations**, then the GitHub integration (the label may be **Connected accounts**).
3. Choose **Configure** or **Manage access**, grant the Railway GitHub App access to organization `warrantyvault` and repository `warrantyvault/WarrantyVault-java`. An organization owner may need to approve the request in GitHub organization settings.
4. In the new project choose **Deploy from GitHub repo**, select `warrantyvault/WarrantyVault-java`, and choose branch `main`. Name the service `<NEW_APP_SERVICE_NAME>` (for example `WarrantyVault`).
5. In the app service's **Settings > Source** (or the current Source/Repository screen), confirm repository `warrantyvault/WarrantyVault-java`, branch `main`, and Root Directory `/`. Do not set the root directory to `server`; the root Dockerfile copies the `server/` Maven project.
6. Push a harmless commit to `main`. Confirm the new project creates a deployment automatically. This confirms the new GitHub integration and auto deploy; do not use the old project's “Could not load branches” state as evidence.

## 2. Add a new MySQL service and migrate the database

1. In the new project choose **Add Service > Database > MySQL** (menu names may be **New > Database**), name it `<NEW_MYSQL_SERVICE_NAME>` (for example `MySQL`), and wait until its volume, Backups tab, and variables are available.
2. The old app's default database may contain unrelated tables. In the **new** MySQL service create a new database and user:

```sql
CREATE DATABASE warrantyvault_prod CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'warrantyvault_app'@'%' IDENTIFIED BY '<DB_PASSWORD>';
GRANT ALL PRIVILEGES ON warrantyvault_prod.* TO 'warrantyvault_app'@'%';
FLUSH PRIVILEGES;
```

Run this from the new MySQL service's current **Data/Console/Query** view (Railway may rename it), or from a local client through its TCP proxy:

```sh
mysql --host=<MYSQL_TCP_PROXY_HOST> --port=<MYSQL_TCP_PROXY_PORT> \
  --user=<MYSQL_ROOT_USER> --password
```

Paste the SQL, verify with `SHOW DATABASES;` and `SHOW GRANTS FOR 'warrantyvault_app'@'%';`, then turn the TCP proxy off. Never commit the password or leave a public proxy enabled.

If the old project contains data to preserve, make a dump from the old MySQL service before changing it:

```sh
mysqldump --host=<OLD_MYSQL_TCP_PROXY_HOST> --port=<OLD_MYSQL_TCP_PROXY_PORT> \
  --user=<OLD_MYSQL_USER> --password \
  --single-transaction --routines --triggers <OLD_DATABASE_NAME> > warrantyvault-old.sql
```

Turn off the old TCP proxy, inspect the dump for unrelated schemas, and restore only the WarrantyVault data into the new database:

```sh
mysql --host=<NEW_MYSQL_TCP_PROXY_HOST> --port=<NEW_MYSQL_TCP_PROXY_PORT> \
  --user=<NEW_MYSQL_ADMIN_USER> --password warrantyvault_prod < warrantyvault-old.sql
```

For a genuinely clean migration, do not restore the old schema: let Flyway create `warrantyvault_prod` during the first deploy. Confirm the new database is empty with `SHOW TABLES;` before deploying. Never point the new service at the old project's database.

## 3. Configure Cloudinary

Create the free account at Cloudinary. In the Console, open **Settings > Product environment > API Keys** (names may be **Account details**). Copy the cloud name, API key, and API secret. Form exactly:

```text
cloudinary://<CLOUDINARY_API_KEY>:<CLOUDINARY_API_SECRET>@<CLOUDINARY_CLOUD_NAME>
```

Set it only as the Railway secret `CLOUDINARY_URL`. Do not put it in frontend code, Git, logs, or this document. Uploads use `type=authenticated`: originals and derived assets require signed access, unlike public assets. Check account security settings, delivery-type restrictions, and the usage dashboard. After the first smoke test, confirm the asset under **Media Library** in folder `warrantyvault/<space-id>`; it should not be anonymously fetchable.

To rotate the secret, create/rotate the API secret in the API key/account screen, update the sealed Railway `CLOUDINARY_URL`, redeploy, and revoke the old secret only after the new deployment passes. Watch the free-plan storage, monthly bandwidth, transformations, and Admin API quota in the current Cloudinary usage/billing page; quotas and plan names can change.

## 4. Configure variables on the new app service

In `<NEW_APP_SERVICE_NAME>` open **Variables** and add these to the app service. Use **sealed/hidden** for every value containing a password, token, key, or URL with credentials when Railway offers that option. Reference the new service name exactly as Railway displays it; if it contains spaces, use Railway's generated reference syntax from the variable editor.

| Name | Exact value | Source | Required |
|---|---|---|---|
| `SPRING_PROFILES_ACTIVE` | `prod` | Fixed | Yes |
| `DB_URL` | `jdbc:mysql://${{<NEW_MYSQL_SERVICE_NAME>.MYSQLHOST}}:${{<NEW_MYSQL_SERVICE_NAME>.MYSQLPORT}}/warrantyvault_prod?useSSL=true&requireSSL=true&serverTimezone=UTC&characterEncoding=utf8&connectionCollation=utf8mb4_unicode_ci` | New MySQL service reference variables | Yes |
| `DB_USER` | `warrantyvault_app` | User created above | Yes |
| `DB_PASSWORD` | `<DB_PASSWORD>` | User created above | Yes |
| `JWT_SECRET` | `<output of openssl rand -base64 48>` | Generate locally | Yes |
| `APP_COOKIE_SECURE` | `true` | Fixed for HTTPS | Yes |
| `APP_SEED_DEMO_DATA` | `false` | Fixed | Yes |
| `APP_STORAGE_PROVIDER` | `cloudinary` | Fixed | Yes |
| `CLOUDINARY_URL` | `cloudinary://<API_KEY>:<API_SECRET>@<CLOUD_NAME>` | Cloudinary API Keys | Yes |
| `PORT` | *(leave unset)* | Railway injects the target port | Optional |

Generate the JWT secret without recording it:

```sh
openssl rand -base64 48
```

Delete `CORS_ALLOWED_ORIGINS`, all old-project `DB_URL`, `DB_USER`, and `DB_PASSWORD` values, and any other unused legacy variables before the first deploy. Do not copy the old project's `MYSQL_*` variables into the app service; use references to the new MySQL service. Do not add CORS support: the app and browser share one origin. `app.storage.provider` is the Spring environment property represented by `APP_STORAGE_PROVIDER`.

## 5. Service settings

Open `<NEW_APP_SERVICE_NAME> > Settings`:

* Source: repository `warrantyvault/WarrantyVault-java`, branch `main`, Root Directory `/`.
* Build: **Dockerfile** builder, path `/Dockerfile` (the committed `railway.json` selects it).
* Networking: choose **Generate Domain** and record `<NEW_RAILWAY_DOMAIN>`; target port is the injected `PORT` (normally 8080). The container binds `0.0.0.0`.
* Deploy: healthcheck path `/api/health`; restart policy **ON_FAILURE**, maximum retries `5`.
* Region: choose the region nearest users and the MySQL service. If the UI uses a different label, choose the app's deployment region setting.

## 6. Deploy and verify

Click **Deploy** or push to `main`. Logs should show Flyway applying migrations to the empty `warrantyvault_prod` schema, storage provider `cloudinary`, and no startup exception. Confirm:

```sh
curl -i https://<NEW_RAILWAY_DOMAIN>/api/health
# 200 and {"status":"UP"}
```

In a private browser window, register, create a Space, add a product with a bill, confirm the asset appears in Cloudinary Media Library, and confirm the bill displays in the app. Do not copy a Cloudinary delivery URL into the browser. Redeploy, then confirm login, the product, and its image still exist.

### Migration cutover

If the old project had live users, schedule a short maintenance window. Announce read-only/freeze time, stop the old app service, take one final old-project MySQL dump, restore it into the new project's `warrantyvault_prod`, and redeploy the new app. Repeat the health, login, product, and image checks. Then point the production/custom DNS name at the new Railway domain, wait for TLS, and run `curl -i https://<NEW_RAILWAY_DOMAIN>/api/health` again. Keep the old project and its MySQL backup for the agreed rollback window; only then remove the old public domain, disable its deployment, and delete its service/volume.

## 7. Backups and restore

Use the MySQL service's **Backups** tab to create/verify scheduled backups and test a restore into a separate database before an incident. A manual dump through a private TCP connection is:

```sh
mysqldump --host=<MYSQL_TCP_PROXY_HOST> --port=<MYSQL_TCP_PROXY_PORT> \
  --user=warrantyvault_app --password \
  --single-transaction --routines --triggers warrantyvault_prod > warrantyvault-$(date +%F).sql
```

Turn the proxy off afterward and store the dump encrypted. Restore with `mysql ... warrantyvault_prod < backup.sql`, then redeploy/restart the app. Cloudinary is the other half of a full backup: retain an approved Cloudinary asset export/backup or provider-supported recovery plan alongside the database dump. A database-only restore leaves image keys without image data.

## 8. Optional custom domain

In service **Settings > Networking**, choose **Custom domain**, enter `<YOUR_DOMAIN>`, and create the DNS record Railway shows. Wait for TLS to become active, then test `/api/health`. Cookies remain secure and same-origin; users must use the custom HTTPS host consistently. Do not turn `APP_COOKIE_SECURE` off.

## 9. Rollback and cost checklist

To roll back, open Deployments in the **new** project, choose the last known-good image/commit, and redeploy it. If the database migration is incompatible, restore the matching new-project MySQL backup first; migrations have no down-migrations. Keep Cloudinary assets and database dump from the same recovery point. Keep the old project untouched until the new deployment has passed the smoke test and one redeploy/recovery test.

Weekly, review Railway compute/runtime, MySQL volume and backup usage, egress, and deployment logs; review Cloudinary storage, bandwidth, transformations, and API quota. Set provider spending/usage alerts where available, remove unused deployments, and keep the Cloudinary free plan's limits visible to the operator.

## 10. Troubleshooting

| Symptom | Check and fix |
|---|---|
| Flyway says schema is non-empty | `DB_URL` must name `warrantyvault_prod`, not the old default. Create/use the clean database above; do not delete unrelated production data. |
| Access denied | Verify `DB_USER`/`DB_PASSWORD`, host/port references, and `SHOW GRANTS`; the app user needs privileges only on `warrantyvault_prod.*`. |
| 502 or “application failed to respond” | Check logs for startup failure, Docker build, `server.address=0.0.0.0`, and injected `PORT`; do not hard-code a different public port. |
| Login works but session is lost | Keep `APP_COOKIE_SECURE=true`, use HTTPS, and keep `server.forward-headers-strategy=native`; inspect that the refresh cookie is Secure and SameSite=Lax. |
| Everyone is rate limited | Railway's native forwarded-header handling must be active. The filter buckets `request.getRemoteAddr()` per real client IP; do not allow clients to supply arbitrary forwarded headers through another proxy. |
| Cloudinary 401/signature errors | Rebuild `CLOUDINARY_URL` from the current cloud name/API key/secret, update the sealed variable, and redeploy. Never print the URL. |
| Upload 413 | Check Railway/proxy limits and the app's 10 MB image / 25 MB multipart limits; use a smaller JPEG/PNG/WebP. |
| Image 404 after redeploy | Confirm `APP_STORAGE_PROVIDER=cloudinary` and `storage provider cloudinary` in startup logs. `local` points at ephemeral container disk. |

Cloudinary delivery URLs are signed and short-lived, but the browser receives only the backend response; the authenticated product image endpoint remains the access boundary.
