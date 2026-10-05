package com.warrantyvault.invitation;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
        "spring.datasource.url=jdbc:h2:mem:invitation-acceptance;DB_CLOSE_DELAY=-1",
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "app.storage.local-dir=target/invitation-acceptance"
    }
)
class InvitationAcceptanceIntegrationTest {
    @LocalServerPort
    private int port;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void acceptsInvitationAndReturnsSpaceDetailsAfterServiceTransaction() throws Exception {
        HttpClient client = HttpClient.newHttpClient();
        String baseUrl = "http://localhost:" + port;
        String suffix = UUID.randomUUID().toString();
        String ownerToken = register(client, baseUrl, "owner-" + suffix + "@example.test", "Owner");
        String spaceResponse = send(client, baseUrl, "/api/spaces", ownerToken, "POST",
            "{\"name\":\"Shared Space\",\"description\":\"A shared test space\"}");
        JsonNode space = objectMapper.readTree(spaceResponse);
        assertEquals("Shared Space", space.path("name").asText());

        String invitationResponse = send(client, baseUrl, "/api/spaces/" + space.path("id").asText() + "/invitations",
            ownerToken, "POST", "{\"email\":\"invitee-" + suffix + "@example.test\",\"role\":\"VIEWER\"}");
        String invitationId = objectMapper.readTree(invitationResponse).path("id").asText();
        String inviteeToken = register(client, baseUrl, "invitee-" + suffix + "@example.test", "Invitee");

        JsonNode pending = objectMapper.readTree(send(client, baseUrl, "/api/invitations", inviteeToken, "GET", null));
        assertEquals(invitationId, pending.get(0).path("id").asText());

        String acceptedResponse = send(client, baseUrl, "/api/invitations/" + invitationId + "/accept",
            inviteeToken, "POST", "{}");
        JsonNode acceptedSpace = objectMapper.readTree(acceptedResponse);
        assertEquals(space.path("id").asText(), acceptedSpace.path("id").asText());
        assertEquals("Shared Space", acceptedSpace.path("name").asText());
        assertEquals(200, sendStatus(client, baseUrl, "/api/spaces/" + acceptedSpace.path("id").asText(), inviteeToken));
    }

    private String register(HttpClient client, String baseUrl, String email, String name) throws Exception {
        String response = send(client, baseUrl, "/api/auth/register", null, "POST",
            "{\"name\":\"" + name + "\",\"email\":\"" + email + "\",\"password\":\"SafeTestPassword123!\",\"timezone\":\"UTC\"}");
        return objectMapper.readTree(response).path("accessToken").asText();
    }

    private String send(HttpClient client, String baseUrl, String path, String token, String method, String body) throws Exception {
        HttpRequest.Builder request = HttpRequest.newBuilder(URI.create(baseUrl + path));
        if (token != null) request.header("Authorization", "Bearer " + token);
        if (body != null) request.header("Content-Type", "application/json");
        request.method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(body));
        HttpResponse<String> response = client.send(request.build(), HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new AssertionError(method + " " + path + " returned " + response.statusCode() + ": " + response.body());
        }
        return response.body();
    }

    private int sendStatus(HttpClient client, String baseUrl, String path, String token) throws Exception {
        HttpRequest request = HttpRequest.newBuilder(URI.create(baseUrl + path))
            .header("Authorization", "Bearer " + token)
            .GET()
            .build();
        return client.send(request, HttpResponse.BodyHandlers.discarding()).statusCode();
    }
}
