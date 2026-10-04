FROM eclipse-temurin:21-jdk AS app-build
WORKDIR /workspace
COPY server/.mvn/ .mvn/
COPY server/mvnw server/pom.xml ./
COPY server/src/ src/
RUN chmod +x mvnw && ./mvnw -B -DskipTests package

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
ENV SPRING_PROFILES_ACTIVE=prod
ENV JAVA_TOOL_OPTIONS="-Xmx340m -XX:+UseSerialGC -XX:MaxMetaspaceSize=128m"
COPY --from=app-build /workspace/target/warrantyvault-0.0.1-SNAPSHOT.jar /app/warrantyvault.jar
RUN addgroup -S warrantyvault && adduser -S -G warrantyvault warrantyvault \
    && mkdir -p /app/uploads \
    && chown -R warrantyvault:warrantyvault /app
USER warrantyvault
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/warrantyvault.jar"]
