# WarrantyVault

WarrantyVault is a web app for organizing product warranties, receipts, and
supporting documents. Users can track warranty dates, upload product images,
create shared Spaces, and invite collaborators with role-based access.

**Access it at [This link](https://warrantyvault-java.up.railway.app)**


## Tech stack

| Layer | Technology |
|---|---|
| Backend | Java 21, Spring Boot 4, Spring Security |
| Persistence | Spring Data JPA, Hibernate, Flyway |
| Database | MySQL |
| Frontend | HTML, CSS, vanilla JavaScript |
| Image storage | Cloudinary authenticated assets |
| Hosting | Railway |
| Deployment | Docker, Railway GitHub deployments |
| Health check | `https://warrantyvault-java.up.railway.app/api/health` |

The Spring Boot application serves both the API and frontend from a single
Railway service. Railway provides the production domain and MySQL database,
while Cloudinary stores uploaded bill and warranty-card images. Images are
served through authenticated backend endpoints rather than exposing
Cloudinary URLs directly.

See [docs/DEPLOY-RAILWAY.md](docs/DEPLOY-RAILWAY.md) for deployment
configuration and operational details.
