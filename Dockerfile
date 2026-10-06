FROM eclipse-temurin:21-jdk AS build
WORKDIR /workspace
COPY server/mvnw server/mvnw
COPY server/.mvn server/.mvn
COPY server/pom.xml server/pom.xml
RUN chmod +x server/mvnw && cd server && ./mvnw -B dependency:go-offline
COPY server/src server/src
RUN cd server && ./mvnw -B package -DskipTests

FROM eclipse-temurin:21-jre
WORKDIR /app
RUN useradd --system --create-home --uid 10001 warrantyvault
COPY --from=build /workspace/server/target/*.jar /app/warrantyvault.jar
RUN mkdir -p /app/uploads && chown -R warrantyvault:warrantyvault /app
USER warrantyvault
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75.0"
EXPOSE 8080
ENTRYPOINT ["sh", "-c", "exec java $JAVA_TOOL_OPTIONS -jar /app/warrantyvault.jar --server.port=${PORT:-8080}"]
