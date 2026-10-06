package com.warrantyvault.product;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
        "spring.datasource.url=jdbc:h2:mem:upload-integration;DB_CLOSE_DELAY=-1",
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "app.storage.local-dir=target/upload-integration"
    }
)
class ProductUploadIntegrationTest {
    private static final int UPLOAD_SIZE = 2 * 1024 * 1024;

    @LocalServerPort
    private int port;

    @Test
    void acceptsARealTwoMegabyteBillUpload() throws IOException, InterruptedException {
        HttpClient client = HttpClient.newHttpClient();
        String baseUrl = "http://localhost:" + port;
        String email = "upload-" + UUID.randomUUID() + "@example.test";
        HttpResponse<String> registrationResponse = client.send(HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/api/auth/register"))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString("{\"name\":\"Upload Test\",\"email\":\"" + email
                + "\",\"password\":\"SafeUploadPassword123!\",\"timezone\":\"UTC\"}"))
            .build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(201, registrationResponse.statusCode());
        String registration = registrationResponse.body();
        String accessToken = jsonString(registration, "accessToken");

        HttpResponse<String> spaceHttpResponse = client.send(HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/api/spaces"))
            .header("Authorization", "Bearer " + accessToken)
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString("{\"name\":\"Upload Test Space\",\"description\":\"\"}"))
            .build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(201, spaceHttpResponse.statusCode());
        String spaceResponse = spaceHttpResponse.body();
        String spaceId = jsonString(spaceResponse, "id");

        byte[] bill = new byte[UPLOAD_SIZE];
        bill[0] = (byte) 0xff;
        bill[1] = (byte) 0xd8;
        bill[2] = (byte) 0xff;
        bill[bill.length - 2] = (byte) 0xff;
        bill[bill.length - 1] = (byte) 0xd9;
        String boundary = "WarrantyVault" + UUID.randomUUID();
        byte[] body = multipartBody(boundary, bill);
        HttpResponse<String> response = client.send(HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/api/spaces/" + spaceId + "/products"))
            .header("Authorization", "Bearer " + accessToken)
            .header("Content-Type", "multipart/form-data; boundary=" + boundary)
            .POST(HttpRequest.BodyPublishers.ofByteArray(body))
            .build(), HttpResponse.BodyHandlers.ofString());

        assertEquals(201, response.statusCode(), response.body());
        assertNotNull(response.body());
        assertEquals(UPLOAD_SIZE, jsonInteger(response.body(), "sizeBytes"));

        HttpResponse<String> productsResponse = client.send(HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/api/spaces/" + spaceId + "/products?q=lg&sort=name&size=1&page=0"))
            .header("Authorization", "Bearer " + accessToken)
            .GET()
            .build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(200, productsResponse.statusCode(), productsResponse.body());
        assertTrue(productsResponse.body().contains("\"totalItems\":1"));
        assertTrue(productsResponse.body().contains("\"brand\":\"LG\""));

        HttpResponse<String> literalWildcardResponse = client.send(HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/api/spaces/" + spaceId + "/products?q=%25"))
            .header("Authorization", "Bearer " + accessToken)
            .GET()
            .build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(200, literalWildcardResponse.statusCode(), literalWildcardResponse.body());
        assertTrue(literalWildcardResponse.body().contains("\"totalItems\":0"));

        HttpResponse<String> spaceDetailResponse = client.send(HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/api/spaces/" + spaceId))
            .header("Authorization", "Bearer " + accessToken)
            .GET()
            .build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(200, spaceDetailResponse.statusCode(), spaceDetailResponse.body());
        assertTrue(spaceDetailResponse.body().contains("\"productCount\":1"));

        HttpResponse<String> spacesResponse = client.send(HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/api/spaces"))
            .header("Authorization", "Bearer " + accessToken)
            .GET()
            .build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(200, spacesResponse.statusCode());
        assertTrue(spacesResponse.body().contains(spaceId));

        HttpResponse<String> dashboardResponse = client.send(HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/api/dashboard"))
            .header("Authorization", "Bearer " + accessToken)
            .GET()
            .build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(200, dashboardResponse.statusCode(), dashboardResponse.body());
        assertTrue(dashboardResponse.body().contains("\"INR\":\"5000.50\""));

        String productId = jsonString(response.body(), "id");
        String viewerEmail = "viewer-" + UUID.randomUUID() + "@example.test";
        HttpResponse<String> invitationResponse = client.send(HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/api/spaces/" + spaceId + "/invitations"))
            .header("Authorization", "Bearer " + accessToken)
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(
                "{\"email\":\"" + viewerEmail + "\",\"role\":\"VIEWER\"}"))
            .build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(201, invitationResponse.statusCode(), invitationResponse.body());
        String inviteCode = jsonString(invitationResponse.body(), "inviteCode");
        HttpResponse<String> viewerRegistration = client.send(HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/api/auth/register"))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString("{\"name\":\"Viewer\",\"email\":\"" + viewerEmail
                + "\",\"password\":\"SafeViewerPassword123!\",\"timezone\":\"UTC\"}"))
            .build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(201, viewerRegistration.statusCode(), viewerRegistration.body());
        String viewerToken = jsonString(viewerRegistration.body(), "accessToken");
        HttpResponse<String> acceptedInvitation = client.send(HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/api/invitations/" +
                jsonString(invitationResponse.body(), "id") + "/accept"))
            .header("Authorization", "Bearer " + viewerToken)
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString("{\"code\":\"" + inviteCode + "\"}"))
            .build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(200, acceptedInvitation.statusCode(), acceptedInvitation.body());

        HttpResponse<String> viewerProduct = client.send(HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/api/products/" + productId))
            .header("Authorization", "Bearer " + viewerToken)
            .GET()
            .build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(200, viewerProduct.statusCode(), viewerProduct.body());
        assertTrue(viewerProduct.body().contains("\"canEdit\":false"));
        HttpResponse<byte[]> viewerImage = client.send(HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/api/products/" + productId + "/images/bill"))
            .header("Authorization", "Bearer " + viewerToken)
            .GET()
            .build(), HttpResponse.BodyHandlers.ofByteArray());
        assertEquals(200, viewerImage.statusCode());
        String boundaryForViewer = "Viewer" + UUID.randomUUID();
        HttpResponse<String> viewerUpdate = client.send(HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/api/products/" + productId))
            .header("Authorization", "Bearer " + viewerToken)
            .header("Content-Type", "multipart/form-data; boundary=" + boundaryForViewer)
            .PUT(HttpRequest.BodyPublishers.ofByteArray(
                multipartUpdateBody(boundaryForViewer, 0)))
            .build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(403, viewerUpdate.statusCode(), viewerUpdate.body());
        HttpResponse<String> viewerDelete = client.send(HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/api/products/" + productId))
            .header("Authorization", "Bearer " + viewerToken)
            .DELETE()
            .build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(403, viewerDelete.statusCode(), viewerDelete.body());

        String outsiderToken = register(client, baseUrl,
            "outsider-" + UUID.randomUUID() + "@example.test", "Outsider");
        HttpResponse<String> outsiderProduct = client.send(HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/api/products/" + productId))
            .header("Authorization", "Bearer " + outsiderToken)
            .GET()
            .build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(404, outsiderProduct.statusCode(), outsiderProduct.body());

        String boundaryForOwner = "Owner" + UUID.randomUUID();
        HttpResponse<String> ownerUpdate = client.send(HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/api/products/" + productId))
            .header("Authorization", "Bearer " + accessToken)
            .header("Content-Type", "multipart/form-data; boundary=" + boundaryForOwner)
            .PUT(HttpRequest.BodyPublishers.ofByteArray(
                multipartUpdateBody(boundaryForOwner, 0)))
            .build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(200, ownerUpdate.statusCode(), ownerUpdate.body());
        assertEquals(1, jsonInteger(ownerUpdate.body(), "version"));
        String staleBoundary = "Stale" + UUID.randomUUID();
        HttpResponse<String> staleUpdate = client.send(HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/api/products/" + productId))
            .header("Authorization", "Bearer " + accessToken)
            .header("Content-Type", "multipart/form-data; boundary=" + staleBoundary)
            .PUT(HttpRequest.BodyPublishers.ofByteArray(
                multipartUpdateBody(staleBoundary, 0)))
            .build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(409, staleUpdate.statusCode(), staleUpdate.body());
    }

    private byte[] multipartBody(String boundary, byte[] bill) throws IOException {
        ByteArrayOutputStream body = new ByteArrayOutputStream(bill.length + 512);
        write(body, "--" + boundary + "\r\n"
            + "Content-Disposition: form-data; name=\"data\"\r\n"
            + "Content-Type: application/json\r\n\r\n"
            + "{\"productType\":\"Refrigerator\",\"brand\":\"LG\",\"purchasedOn\":\"2025-01-15\","
            + "\"warrantyMonths\":24,\"purchasePrice\":\"5000.50\",\"currency\":\"INR\"}\r\n"
            + "--" + boundary + "\r\n"
            + "Content-Disposition: form-data; name=\"bill\"; filename=\"bill.jpg\"\r\n"
            + "Content-Type: image/jpeg\r\n\r\n");
        body.write(bill);
        write(body, "\r\n--" + boundary + "--\r\n");
        return body.toByteArray();
    }

    private String register(HttpClient client, String baseUrl, String email, String name)
        throws IOException, InterruptedException {
        HttpResponse<String> response = client.send(HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/api/auth/register"))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString("{\"name\":\"" + name + "\",\"email\":\"" + email
                + "\",\"password\":\"SafeOutsidePassword123!\",\"timezone\":\"UTC\"}"))
            .build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(201, response.statusCode(), response.body());
        return jsonString(response.body(), "accessToken");
    }

    private byte[] multipartUpdateBody(String boundary, int version) throws IOException {
        ByteArrayOutputStream body = new ByteArrayOutputStream();
        write(body, "--" + boundary + "\r\n"
            + "Content-Disposition: form-data; name=\"data\"\r\n"
            + "Content-Type: application/json\r\n\r\n"
            + "{\"productType\":\"Refrigerator\",\"brand\":\"LG\",\"purchasedOn\":\"2025-01-15\","
            + "\"warrantyMonths\":24,\"purchasePrice\":\"5000.50\",\"currency\":\"INR\","
            + "\"removeWarrantyCard\":false,\"version\":" + version + "}\r\n"
            + "--" + boundary + "--\r\n");
        return body.toByteArray();
    }

    private void write(ByteArrayOutputStream output, String value) throws IOException {
        output.write(value.getBytes(StandardCharsets.UTF_8));
    }

    private String jsonString(String json, String property) {
        Matcher matcher = Pattern.compile("\"" + Pattern.quote(property) + "\"\\s*:\\s*\"([^\"]+)\"")
            .matcher(json);
        if (!matcher.find()) throw new AssertionError("Missing JSON string property: " + property);
        return matcher.group(1);
    }

    private int jsonInteger(String json, String property) {
        Matcher matcher = Pattern.compile("\"" + Pattern.quote(property) + "\"\\s*:\\s*(\\d+)")
            .matcher(json);
        if (!matcher.find()) throw new AssertionError("Missing JSON integer property: " + property);
        return Integer.parseInt(matcher.group(1));
    }
}
