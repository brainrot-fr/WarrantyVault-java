# Deploy WarrantyVault to Railway

**Official documentation verified: 2026-10-06.** References: [Railway services](https://docs.railway.com/services#deploying-from-a-github-repo), [Dockerfiles](https://docs.railway.com/builds/dockerfiles), [config as code](https://docs.railway.com/config-as-code/reference), [variables](https://docs.railway.com/variables), [private networking](https://docs.railway.com/networking/private-networking), [MySQL](https://docs.railway.com/databases/mysql), [TCP Proxy](https://docs.railway.com/networking/tcp-proxy), [domains](https://docs.railway.com/networking/domains), [deployments](https://docs.railway.com/deployments/deployment-actions), [GitHub autodeploys](https://docs.railway.com/deployments/github-autodeploys), and [Cloudinary credentials](https://cloudinary.com/documentation/finding_your_credentials_tutorial), [SDK environment variable](https://cloudinary.com/documentation/cloudinary_sdks#environment_variable), [media access](https://cloudinary.com/documentation/control_access_to_media), [Media Library](https://cloudinary.com/documentation/asset_management), and [billing](https://cloudinary.com/documentation/billing_and_plans). Railway and Cloudinary may rename buttons; follow the current official page and choose the equivalent Source, Variables, Deploy, Healthcheck, API Keys, or Media Library screen.

This architecture has one Railway app service. Its Spring Boot jar serves both the API and vanilla frontend, so the browser uses one origin and no CORS configuration is needed. MySQL stores records; Cloudinary stores authenticated bill and warranty-card images. Cloudinary URLs are never sent to the browser: `ProductController` streams images through the authenticated endpoint.

## 0. Prepare `main` before touching Railway

1. Merge the commits for production configuration, the Dockerfile/Railway health configuration, and Cloudinary storage into `main`.
2. On your workstation, run `git switch main && git pull --ff-only`, then confirm:

   ```sh
   test -f Dockerfile && test -f railway.json && git status --short
   ```

   The command must find both files and `git status` must be clean. A first deploy without the root `Dockerfile` and `railway.json` fails or uses the wrong build context; the Maven project is under `server/`, not the repository root.

## 1. Give Railway access to GitHub

1. Sign in to Railway and open account **Settings > GitHub** (the label may be **Integrations** or **Connected accounts**).
2. Choose **Install/Configure Railway GitHub App**. In GitHub, select the `warrantyvault` organization and grant access to `warrantyvault/WarrantyVault-java` (or all repositories only if that is your policy).
3. If GitHub says approval is required, ask an organization owner to approve the pending third-party application request in the organization settings. Do not continue until it is approved.
4. Return to Railway, refresh the repository picker, and verify that `warrantyvault/WarrantyVault-java` and branch `main` are listed. If they are absent, repeat the app installation with the organization selected; do not create a different repository.

## 2. Create the Railway project

1. Choose **New Project > Deploy from GitHub repo** (current UI may say **Create Project** or **Connect Repo**).
2. Select `warrantyvault/WarrantyVault-java`, branch `main`, and name the app service `<APP_SERVICE_NAME>`.
3. Leave the root directory as `/`. Do not set it to `server`: the root Dockerfile copies `server/mvnw`, `server/pom.xml`, and `server/src`.
4. The first build reads `railway.json`, builds the multi-stage Temurin JDK 21 image, and creates the jar. A failure before variables are configured is expected because the prod profile requires `DB_URL`, `MYSQL_USER`, `MYSQL_PASSWORD`, and `APP_JWT_SECRET`; continue to the next steps before diagnosing startup.

## 3. Add MySQL in the same project

1. In the project choose **Add Service > Database > MySQL** (the current equivalent may be **New > Database**). Name it `<MYSQL_SERVICE_NAME>`, for example `MySQL`.
2. Open that service's **Variables**. The generated connection values are `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, and `MYSQLDATABASE`. They are available to other services through Railway references.
3. The default database is empty. That is intentional: Flyway creates WarrantyVault's schema on the first successful app start. Confirm the database charset with a MySQL client:

   ```sql
   SELECT DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME
   FROM information_schema.SCHEMATA
   WHERE SCHEMA_NAME = '<MYSQL_DATABASE_NAME>';
   ```

   If it is not `utf8mb4`, run:

   ```sql
   ALTER DATABASE `<MYSQL_DATABASE_NAME>` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

4. For an optional least-privilege user, connect as the generated admin and run:

   ```sql
   CREATE USER '<APP_DB_USER>'@'%' IDENTIFIED BY '<APP_DB_PASSWORD>';
   GRANT ALL PRIVILEGES ON `<MYSQL_DATABASE_NAME>`.* TO '<APP_DB_USER>'@'%';
   FLUSH PRIVILEGES;
   ```

   Private networking uses Railway's internal hostname and is the app's normal path. The public TCP Proxy is for temporary external tools such as `mysql` and `mysqldump`; enable it only while needed, restrict access if Railway offers that control, and disable it afterward. Do not put proxy host/port in `DB_URL`.

## 4. Create and configure Cloudinary

1. Create a free Cloudinary account. In the Console open **Settings > Product environment > API Keys** (or **Account details/API Keys**).
2. Copy the **cloud name**, **API key**, and **API secret**. Form this value, without spaces:

   ```text
   cloudinary://<CLOUDINARY_API_KEY>:<CLOUDINARY_API_SECRET>@<CLOUDINARY_CLOUD_NAME>
   ```

3. Cloudinary's `authenticated` delivery type is private: an unsigned public delivery URL must not work. WarrantyVault signs a short-lived URL on the server, downloads the bytes, and returns them only from the authenticated product image route. No transformation is requested.
4. In Cloudinary account/security settings, review allowed delivery types and API access. After the first upload, open **Media Library** and confirm an asset under `Home/bills/<space-id>`. The Cloudinary public ID is `<space-id>/<file-id>`; `Home/bills` is set as the asset folder separately to avoid duplicated folder paths. Do not paste the secret into the browser, repository, issue tracker, or logs.
5. To rotate the secret, create a new API secret/key pair, replace the sealed Railway `CLOUDINARY_URL`, redeploy, smoke-test an image, then revoke the old pair. Watch the free plan's storage, bandwidth, transformations, and Admin API limits in the current Usage/Billing screen; free quotas and names can change.

## 5. Add app variables

Open `<APP_SERVICE_NAME> > Variables`. Enter these exact values. Replace `<MYSQL_SERVICE_NAME>` with the service name shown by Railway (for example `MySQL`). Mark passwords, tokens, and credential-bearing URLs as **sealed/hidden** when that option exists.

| Name | Value | Comes from | Required |
|---|---|---|---|
| `SPRING_PROFILES_ACTIVE` | `prod` | Fixed | Yes |
| `DB_URL` | `jdbc:mysql://${{<MYSQL_SERVICE_NAME>.MYSQLHOST}}:${{<MYSQL_SERVICE_NAME>.MYSQLPORT}}/${{<MYSQL_SERVICE_NAME>.MYSQLDATABASE}}?useSSL=true&requireSSL=true&serverTimezone=UTC&characterEncoding=utf8&connectionCollation=utf8mb4_unicode_ci` | MySQL reference variables | Yes |
| `MYSQL_USER` | `${{<MYSQL_SERVICE_NAME>.MYSQLUSER}}` | MySQL reference | Yes |
| `MYSQL_PASSWORD` | `${{<MYSQL_SERVICE_NAME>.MYSQLPASSWORD}}` | MySQL reference | Yes |
| `APP_JWT_SECRET` | `<output of openssl rand -base64 48>` | Generate locally | Yes |
| `APP_COOKIE_SECURE` | `true` | Fixed for HTTPS | Yes |
| `APP_SEED_DEMO_DATA` | `false` | Fixed | Yes |
| `APP_STORAGE_PROVIDER` | `cloudinary` | Fixed | Yes |
| `CLOUDINARY_URL` | `cloudinary://<CLOUDINARY_API_KEY>:<CLOUDINARY_API_SECRET>@<CLOUDINARY_CLOUD_NAME>` | Cloudinary API Keys | Yes |
| `PORT` | leave unset | Railway injects it | Optional |

Generate the JWT secret and paste the output directly into the sealed variable field:

```sh
openssl rand -base64 48
```

Railway's **Raw Editor** can paste a complete variable block in bulk; verify the preview before saving. Do not add CORS variables. The same-origin design does not need CORS. The app keeps SameSite `Lax`; `APP_COOKIE_SECURE=true` makes the refresh cookie HTTPS-only.

## 6. Service settings

In `<APP_SERVICE_NAME> > Settings`, verify:

* Source repository `warrantyvault/WarrantyVault-java`, branch `main`, root `/`.
* Builder **Dockerfile**, path `/Dockerfile`; `railway.json` selects this automatically.
* **Generate Domain** and record `https://<RAILWAY_DOMAIN>`. Target port is Railway's injected `PORT` (normally 8080); the app binds `0.0.0.0`.
* Healthcheck path `/api/health`.
* Restart policy `ON_FAILURE`, maximum retries `5`.
* Region near your users and the MySQL service. If the label differs, use the current deployment-region setting.

## 7. Deploy and verify

Deploy from the Railway UI or push a commit to `main`. In logs expect Flyway migrations to apply to the empty database, a Cloudinary storage-provider startup line, and no startup exception. Verify the public health route:

```sh
curl -i https://<RAILWAY_DOMAIN>/api/health
# HTTP 200
# {"status":"UP"}
```

In a private browser window: register, create a Space, add a product with a bill, confirm the asset appears in Cloudinary under `Home/bills/<space-id>`, and confirm the bill displays in the app. Inspect the browser network response: it should be the authenticated `/api/products/<id>/images/bill` response, never a Cloudinary URL. Trigger **Redeploy** once more and repeat the image check; both database data and the image must survive.

`server.forward-headers-strategy=native` makes the servlet request scheme and remote address reflect Railway's proxy headers, so `RateLimitFilter` buckets by the real client IP. This relies on Railway being the trusted proxy. Do not expose the app directly without a trusted proxy: a client that can inject `Forwarded`/`X-Forwarded-For` can spoof the bucket IP and evade or shift rate limits.

## 8. Auto deploy and rollback

With the GitHub source connected, pushes to `main` auto-deploy. Confirm the deployment list shows the commit SHA after a test push. To roll back, open the last known-good deployment, choose **Redeploy/Rollback** (the current equivalent may be **Deploy this version**), wait for healthcheck success, then fix or revert the bad commit on `main` so the repository and running service converge.

## 9. Backups and restore

Enable and review Railway MySQL volume/database backups in the service's **Backups** tab and test a restore into a non-production database. For an external dump, temporarily enable the MySQL TCP Proxy and run:

```sh
mysqldump --host=<TCP_PROXY_HOST> --port=<TCP_PROXY_PORT> \
  --user=<MYSQL_USER> --password --single-transaction --routines --triggers \
  <MYSQL_DATABASE_NAME> > warrantyvault-<YYYY-MM-DD>.sql
mysql --host=<TCP_PROXY_HOST> --port=<TCP_PROXY_PORT> \
  --user=<MYSQL_USER> --password <MYSQL_DATABASE_NAME> < warrantyvault-<YYYY-MM-DD>.sql
```

Disable the proxy after the operation and keep dumps encrypted. A complete backup has two halves: the MySQL dump/backup **and Cloudinary assets**. Cloudinary is the image source of truth; retain its account/versioned-asset backup or export plan as appropriate for the plan. The local README backup instructions remain for local disk mode; production uses this MySQL plus Cloudinary procedure.

## 10. Optional custom domain

In the app service **Networking/Domains**, add `<CUSTOM_DOMAIN>` and follow the displayed DNS records. Keep HTTPS enabled. The cookie is host-scoped by default, so users may need to sign in again after switching from the Railway domain; `Secure` and SameSite `Lax` still apply. Do not broaden cookie domain settings unless every subdomain is trusted.

## 11. Cost-watching checklist

* Railway: review service usage, build minutes, egress, MySQL volume size, backup retention, and the selected region monthly.
* Cloudinary: review storage, bandwidth, transformations, Admin API calls, and the free-plan quota dashboard before load tests.
* Set billing alerts/budgets where available, remove unused preview deployments and TCP proxies, and keep upload limits at the application default (10 MB per image).
* Verify that authenticated delivery and the backend stream do not accidentally create public transformed copies.

## 12. Troubleshooting

| Symptom | Check and fix |
|---|---|
| Build cannot find the project | Repository root must be `/`; `Dockerfile` and `railway.json` must be on `main`. Do not set root to `server`. |
| Flyway errors | Confirm the database is empty or contains this app's schema, `utf8mb4`, and a reachable private host. Do not point at an old project's database. |
| Access denied / unknown database | Check `MYSQL_USER`, `MYSQL_PASSWORD`, and `${{<MYSQL_SERVICE_NAME>.MYSQLDATABASE}}`; verify grants and that `DB_URL` uses the internal host/port. |
| 502 / application failed to respond | Confirm prod profile, `server.address=0.0.0.0`, and the injected `PORT`; do not hard-code another port in Railway. |
| Login works but session is lost | Use HTTPS, set `APP_COOKIE_SECURE=true`, keep SameSite `Lax`, and retain `server.forward-headers-strategy=native`. |
| Everyone is rate limited | Check trusted Railway forwarded headers and the proxy path; untrusted clients must not be able to spoof `Forwarded` or `X-Forwarded-For`. |
| Cloudinary 401/signature errors | Re-form `CLOUDINARY_URL`, rotate/re-enter the API secret, verify cloud name, and ensure authenticated delivery is enabled. Never log the URL. |
| Upload 413 | The application accepts images up to 10 MB and total multipart requests up to 25 MB; check the file and any current proxy limit. |
| Image 404 after redeploy | Confirm `APP_STORAGE_PROVIDER=cloudinary`, not `local`; local disk is ephemeral on a Railway redeploy. Check the asset in Media Library. |
| Healthcheck failing | `GET /api/health` must be public and return 200. Check the generated domain, target `PORT`, bind address, startup logs, and that the health path is exactly `/api/health`. |
