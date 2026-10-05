# Local development

WarrantyVault runs on your computer with Java 21 and a local MySQL server. The app binds only to `127.0.0.1`; its UI, API, database, and uploaded documents are local. It does not use a cloud database, external API, or hosted deployment.

## Prerequisites

- Java 21
- MySQL 8
- Git

The Maven wrapper is included; no system Maven installation is needed.

## Create the local database

Connect to your local MySQL server as an administrator:

```sh
mysql -u root -p
```

Create the application database and a dedicated local user:

```sql
CREATE DATABASE warrantyvault CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'warrantyvault'@'127.0.0.1' IDENTIFIED BY 'choose-a-local-password';
GRANT ALL PRIVILEGES ON warrantyvault.* TO 'warrantyvault'@'127.0.0.1';
```

The app connects to `127.0.0.1:3306/warrantyvault`. Flyway creates the tables at startup. Set `MYSQL_USER` and `MYSQL_PASSWORD` if you chose credentials other than the defaults.

## Run the application

Start the app from the repository root:

```sh
MYSQL_USER=warrantyvault MYSQL_PASSWORD='choose-a-local-password' make run
```

Open <http://127.0.0.1:8080>. Java and MySQL must both be running locally.

You can also export the database credentials in your shell before running:

```sh
export MYSQL_USER=warrantyvault
export MYSQL_PASSWORD='choose-a-local-password'
make run
```

Warranty status uses `app.expiring-soon-days`, which defaults to `30` in `server/src/main/resources/application.properties`.

## Demo accounts

The application seeds these accounts and sample records when the database is empty:

| Email | Password | Access |
| --- | --- | --- |
| `demo@warrantyvault.local` | `Password123!` | Owner of the Home and Farmhouse Spaces |
| `family@warrantyvault.local` | `Password123!` | Viewer in Home with a pending Farmhouse invitation |

Sample products include active, expiring-soon, and expired coverage. To start with a clean account, register another user in the application.

## Local data and reset

- MySQL database: `warrantyvault` on `127.0.0.1:3306`.
- Uploaded bills and warranty cards: `server/uploads/`.
- Generated demo images: stored in the same local uploads directory.

To reset the database, stop the app and run these statements in MySQL. **This permanently deletes all local users, Spaces, products, and invitations.**

```sql
DROP DATABASE warrantyvault;
CREATE DATABASE warrantyvault CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Uploaded images are stored separately. Remove files in `server/uploads/` only if you also want to delete the saved document images.

## Tests

Run all application checks from the repository root:

```sh
make test
```

The automated integration tests use an in-memory H2 database; running the application itself always uses the local MySQL database.
