# WarrantyVault

WarrantyVault is a warranty tracker. Local development stores private document images on the application computer; production can store them as authenticated Cloudinary assets while the backend continues streaming them through authenticated endpoints.

## Requirements

- Java 21
- MariaDB 10.5 or later, or MySQL 8 or later
- `make`, or use the included Maven wrapper at `server/mvnw`
- OpenSSL for the `make secret` helper

The browser interface uses plain HTML, CSS, and JavaScript. It does not need a separate frontend build.

Hibernate selects the matching MariaDB or MySQL dialect from the JDBC server metadata. Other database types use Hibernate's built-in dialect detection.

## Database setup

Create a database and a local database user. Replace the password below with the value you will put in `.env`.

```sql
CREATE DATABASE warrantyvault CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'warrantyvault'@'localhost' IDENTIFIED BY 'choose-a-local-password';
GRANT ALL PRIVILEGES ON warrantyvault.* TO 'warrantyvault'@'localhost';
```

Copy `.env.example` to `.env`, then set `MYSQL_USER` and `MYSQL_PASSWORD` to the database user and password. Keep `.env` private. The first run applies database migrations. Back up the database and uploads before upgrading because migrations are not reversible.

## Configuration

The `.env` file supports these variables:

- `MYSQL_USER` and `MYSQL_PASSWORD`: database credentials.
- `APP_JWT_SECRET`: signing key for access tokens. Generate one with `make secret`. WarrantyVault refuses to start if it is missing or weak. The old published key is no longer accepted.
- `APP_COOKIE_SECURE`: set to `true` when the app is served through HTTPS. It defaults to `false` for local loopback use.
- `APP_SEED_DEMO_DATA`: defaults to `false`. Set it to `true` only for an empty local demo installation.
- `APP_DEMO_PASSWORD`: a private, unique password required by `make demo`. It must be 8 to 72 UTF-8 bytes and not be on the common-password list.

Additional application properties can be supplied through Spring environment variables or `application.properties`:

- `app.storage.local-dir`: upload directory. The default is `./uploads`.
- `APP_STORAGE_PROVIDER`: `local` by default; set `cloudinary` in production with `CLOUDINARY_URL`.
- `app.max-upload-bytes`: maximum image size in bytes. The default is 10 MB.
- `app.expiring-soon-days`: expiring-soon window in days. The default is 30.
- `app.storage.max-bytes-per-space`: optional per-Space quota in bytes. The default is 2147483648. Set it to `0` to disable the quota.

The application listens on `127.0.0.1` by default.

## Run and test

```sh
cp .env.example .env
# Edit .env with your database credentials.
make secret
make run
```

Open [http://127.0.0.1:8080](http://127.0.0.1:8080). If WarrantyVault is already responding on port 8080, `make run` reports that instance instead of attempting to start a duplicate. Run the test suite with:

```sh
make test
```

`make demo` enables sample data for a local demo. On an empty database it creates `demo@warrantyvault.local` and `family@warrantyvault.local` with the password supplied in `APP_DEMO_PASSWORD`. The seeder runs only when `server.address` is loopback. Do not reuse a real account password for the demo.

## Where your data lives

Product details, accounts, Spaces, invitations, and refresh sessions are stored in the MariaDB or MySQL database. With the default `local` provider, uploaded images are stored in the configured upload directory. With `cloudinary`, images are authenticated Cloudinary assets and are never exposed directly to the browser.

## Backup and restore

Stop the application before making a consistent local backup. Save a database dump and a copy of the upload directory:

```sh
mysqldump warrantyvault > backup.sql
cp -a ./uploads ./uploads-backup
```

Restore the database and uploads directory together for local storage. In Railway, use the MySQL Backups tab for the database and Cloudinary's account/export tooling or a separately maintained asset backup for images; both halves are required. Schema migrations are additive but do not include down-migrations. See [docs/DEPLOY-RAILWAY.md](docs/DEPLOY-RAILWAY.md).

## Deployment

See [docs/DEPLOY-RAILWAY.md](docs/DEPLOY-RAILWAY.md) for the Railway, MySQL, Cloudinary, variables, backup, rollback, and troubleshooting runbook.

## Sharing a Space

WarrantyVault listens on `127.0.0.1`, so it is available only on the same computer by default. People on other devices cannot connect unless you place the app behind a reverse proxy with HTTPS. For that setup, configure `server.address` for the intended network interface and set `APP_COOKIE_SECURE=true`. Do not expose the app directly to an untrusted network.

Invitations do not send email. The Space owner must give the invitee the invitation code using a separate trusted channel. The code is shown once when the invitation is created.

## Warranty dates

The warranty ends on the calculated expiry date, and coverage includes that date. Adding a month to a date near the end of a month clamps to the final valid day of the target month. For example, a purchase on January 31 with a one-month warranty expires on February 28, or February 29 in a leap year.

## Limits and known gaps

- Images must be JPEG, PNG, or WebP and may be up to 10 MB each.
- Password reset is not available.
- Email reminders are not available.
- Account deletion is not available.
- Access tokens last 30 minutes. A rotating refresh cookie keeps a session active until it expires or is revoked.
- If the signing key changes, existing access tokens become invalid. Users can usually continue through their refresh cookie and otherwise need to sign in again.
