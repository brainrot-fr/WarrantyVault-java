FROM node:22-alpine AS frontend-build
WORKDIR /frontend
COPY frontend/ ./
RUN npm ci && npm run build

FROM eclipse-temurin:21-jdk AS backend-build
WORKDIR /workspace
COPY backend/.mvn/ .mvn/
COPY backend/mvnw backend/pom.xml ./
COPY backend/src/ src/
COPY --from=frontend-build /frontend/dist/ src/main/resources/static/
RUN chmod +x mvnw && ./mvnw -B -DskipTests package

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
ENV SPRING_PROFILES_ACTIVE=prod
ENV JAVA_TOOL_OPTIONS="-Xmx340m -XX:+UseSerialGC -XX:MaxMetaspaceSize=128m"
COPY --from=backend-build /workspace/target/backend-0.0.1-SNAPSHOT.jar /app/warrantyvault.jar
RUN addgroup -S warrantyvault && adduser -S -G warrantyvault warrantyvault \
    && mkdir -p /app/uploads \
    && chown -R warrantyvault:warrantyvault /app
USER warrantyvault
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/warrantyvault.jar"]
