package com.warrantyvault.invitation;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.UUID;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.beans.factory.annotation.Autowired;

@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
        "spring.datasource.url=jdbc:h2:mem:invitation-acceptance;DB_CLOSE_DELAY=-1",
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "app.storage.local-dir=target/invitation-acceptance",
        "app.rate-limit.register-per-hour=30"
    }
)
class InvitationAcceptanceIntegrationTest {
    @LocalServerPort
    private int port;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    private InvitationRepository invitationRepository;

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
        JsonNode invitation = objectMapper.readTree(invitationResponse);
        String invitationId = invitation.path("id").asText();
        String inviteCode = invitation.path("inviteCode").asText();
        assertEquals(12, inviteCode.length());
        JsonNode ownerListing = objectMapper.readTree(send(client, baseUrl,
            "/api/spaces/" + space.path("id").asText() + "/members", ownerToken, "GET", null));
        assertTrue(ownerListing.path("invitations").get(0).path("inviteCode").isNull());
        String inviteeToken = register(client, baseUrl, "invitee-" + suffix + "@example.test", "Invitee");

        JsonNode pending = objectMapper.readTree(send(client, baseUrl, "/api/invitations", inviteeToken, "GET", null));
        assertEquals(invitationId, pending.get(0).path("id").asText());

        HttpResponse<String> wrongCode = sendResponse(client, baseUrl, "/api/invitations/" + invitationId + "/accept",
            inviteeToken, "POST", "{\"code\":\"WRONGCODE123\"}");
        assertEquals(400, wrongCode.statusCode());
        assertEquals("INVALID_INVITE_CODE", objectMapper.readTree(wrongCode.body()).path("code").asText());
        String acceptedResponse = send(client, baseUrl, "/api/invitations/" + invitationId + "/accept",
            inviteeToken, "POST", "{\"code\":\"" + inviteCode + "\"}");
        JsonNode acceptedSpace = objectMapper.readTree(acceptedResponse);
        assertEquals(space.path("id").asText(), acceptedSpace.path("id").asText());
        assertEquals("Shared Space", acceptedSpace.path("name").asText());
        assertEquals(200, sendStatus(client, baseUrl, "/api/spaces/" + acceptedSpace.path("id").asText(), inviteeToken));
    }

    @Test
    void expiresLegacyInvitationWithoutCodeInsteadOfAcceptingUnverifiedEmail() throws Exception {
        HttpClient client = HttpClient.newHttpClient();
        String baseUrl = "http://localhost:" + port;
        String suffix = UUID.randomUUID().toString();
        String email = "legacy-" + suffix + "@example.test";
        String ownerToken = register(client, baseUrl, "legacy-owner-" + suffix + "@example.test", "Owner");
        JsonNode space = objectMapper.readTree(send(client, baseUrl, "/api/spaces", ownerToken, "POST",
            "{\"name\":\"Legacy Invitation Space\",\"description\":\"\"}"));
        JsonNode created = objectMapper.readTree(send(client, baseUrl,
            "/api/spaces/" + space.path("id").asText() + "/invitations", ownerToken, "POST",
            "{\"email\":\"" + email + "\",\"role\":\"VIEWER\"}"));
        String invitationId = created.path("id").asText();
        Invitation legacy = invitationRepository.findById(invitationId).orElseThrow();
        legacy.setTokenHash(null);
        invitationRepository.saveAndFlush(legacy);
        String inviteeToken = register(client, baseUrl, email, "Invitee");

        HttpResponse<String> acceptance = sendResponse(client, baseUrl,
            "/api/invitations/" + invitationId + "/accept", inviteeToken, "POST",
            "{\"code\":\"ABCDEFGHJK23\"}");

        assertEquals(400, acceptance.statusCode());
        assertEquals("INVALID_INVITE_CODE", objectMapper.readTree(acceptance.body()).path("code").asText());
        assertEquals("EXPIRED", invitationRepository.findById(invitationId).orElseThrow().getStatus());
    }

    @Test
    void persistsExpiredStatusWhenInviteeAttemptsToAcceptAnExpiredInvitation() throws Exception {
        HttpClient client = HttpClient.newHttpClient();
        String baseUrl = "http://localhost:" + port;
        String suffix = UUID.randomUUID().toString();
        String email = "expired-" + suffix + "@example.test";
        String ownerToken = register(client, baseUrl, "expired-owner-" + suffix + "@example.test", "Owner");
        JsonNode space = objectMapper.readTree(send(client, baseUrl, "/api/spaces", ownerToken, "POST",
            "{\"name\":\"Expired Invitation Space\",\"description\":\"\"}"));
        JsonNode created = objectMapper.readTree(send(client, baseUrl,
            "/api/spaces/" + space.path("id").asText() + "/invitations", ownerToken, "POST",
            "{\"email\":\"" + email + "\",\"role\":\"VIEWER\"}"));
        String invitationId = created.path("id").asText();
        String code = created.path("inviteCode").asText();
        Invitation invitation = invitationRepository.findById(invitationId).orElseThrow();
        invitation.setExpiresAt(Instant.parse("2020-01-01T00:00:00Z"));
        invitationRepository.saveAndFlush(invitation);
        String inviteeToken = register(client, baseUrl, email, "Invitee");

        HttpResponse<String> acceptance = sendResponse(client, baseUrl,
            "/api/invitations/" + invitationId + "/accept", inviteeToken, "POST",
            "{\"code\":\"" + code + "\"}");

        assertEquals(409, acceptance.statusCode());
        assertEquals("INVITE_EXPIRED", objectMapper.readTree(acceptance.body()).path("code").asText());
        assertEquals("EXPIRED", invitationRepository.findById(invitationId).orElseThrow().getStatus());
    }

    private String register(HttpClient client, String baseUrl, String email, String name) throws Exception {
        String response = send(client, baseUrl, "/api/auth/register", null, "POST",
            "{\"name\":\"" + name + "\",\"email\":\"" + email + "\",\"password\":\"SafeTestPassword123!\",\"timezone\":\"UTC\"}");
        return objectMapper.readTree(response).path("accessToken").asText();
    }

    private String send(HttpClient client, String baseUrl, String path, String token, String method, String body) throws Exception {
        HttpResponse<String> response = sendResponse(client, baseUrl, path, token, method, body);
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new AssertionError(method + " " + path + " returned " + response.statusCode() + ": " + response.body());
        }
        return response.body();
    }

    private HttpResponse<String> sendResponse(HttpClient client, String baseUrl, String path, String token,
                                             String method, String body) throws Exception {
        HttpRequest.Builder request = HttpRequest.newBuilder(URI.create(baseUrl + path));
        if (token != null) request.header("Authorization", "Bearer " + token);
        if (body != null) request.header("Content-Type", "application/json");
        request.method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(body));
        HttpResponse<String> response = client.send(request.build(), HttpResponse.BodyHandlers.ofString());
        return response;
    }

    private int sendStatus(HttpClient client, String baseUrl, String path, String token) throws Exception {
        HttpRequest request = HttpRequest.newBuilder(URI.create(baseUrl + path))
            .header("Authorization", "Bearer " + token)
            .GET()
            .build();
        return client.send(request, HttpResponse.BodyHandlers.discarding()).statusCode();
    }
}
