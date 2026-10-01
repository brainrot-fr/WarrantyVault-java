FROM eclipse-temurin:21-jdk AS build
WORKDIR /workspace
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
COPY src/ src/
RUN chmod +x mvnw && ./mvnw -B -DskipTests package

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
ENV SPRING_PROFILES_ACTIVE=prod
ENV JAVA_TOOL_OPTIONS="-Xmx340m -XX:+UseSerialGC -XX:MaxMetaspaceSize=128m"
COPY --from=build /workspace/target/backend-0.0.1-SNAPSHOT.jar /app/warrantyvault.jar
RUN addgroup -S warrantyvault && adduser -S -G warrantyvault warrantyvault \
    && chown warrantyvault:warrantyvault /app/warrantyvault.jar
USER warrantyvault
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/warrantyvault.jar"]
