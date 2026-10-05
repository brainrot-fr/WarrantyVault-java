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
