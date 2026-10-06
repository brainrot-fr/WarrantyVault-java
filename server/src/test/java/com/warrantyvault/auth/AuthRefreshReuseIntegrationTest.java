package com.warrantyvault.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.warrantyvault.WarrantyVaultApplication;
import com.warrantyvault.security.RefreshToken;
import com.warrantyvault.security.RefreshTokenRepository;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Date;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@SpringBootTest(
    classes = WarrantyVaultApplication.class,
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
        "spring.datasource.url=jdbc:h2:mem:refresh-reuse;DB_CLOSE_DELAY=-1",
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "app.storage.local-dir=target/refresh-reuse",
        "app.refresh-grace-seconds=1"
    }
)
@Import(AuthRefreshReuseIntegrationTest.MutableClockConfiguration.class)
class AuthRefreshReuseIntegrationTest {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Instant START = Instant.parse("2026-10-01T00:00:00Z");

    @LocalServerPort
    private int port;

    @Autowired
    private MutableClock clock;

    @Autowired
    private RefreshTokenRepository tokens;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @Test
    void reuseOutsideGraceRevokesAndPersistsTheWholeFamily() throws Exception {
        HttpClient client = HttpClient.newHttpClient();
        String base = "http://localhost:" + port;
        String email = "replay-" + UUID.randomUUID() + "@example.test";
        String tokenA = register(client, base, email);
        String tokenHash = hash(tokenA);
        String familyId = new TransactionTemplate(transactionManager).execute(status ->
            tokens.findByTokenHashForUpdate(tokenHash).orElseThrow().getFamilyId());
        String tokenB = cookieValue(refresh(client, base, tokenA));

        clock.advance(Duration.ofSeconds(2));
        assertEquals(401, refresh(client, base, tokenA).statusCode());
        assertEquals(401, refresh(client, base, tokenB).statusCode());
        assertTrue(tokens.findByFamilyId(familyId).stream().allMatch(token -> token.getRevokedAt() != null));
    }

    @Test
    void reuseInsideGraceReturnsTheSameReplacementAndLeavesItUsable() throws Exception {
        HttpClient client = HttpClient.newHttpClient();
        String base = "http://localhost:" + port;
        String tokenA = register(client, base, "grace-" + UUID.randomUUID() + "@example.test");
        HttpResponse<String> first = refresh(client, base, tokenA);
        String tokenB = cookieValue(first);
        HttpResponse<String> replay = refresh(client, base, tokenA);
        assertEquals(200, replay.statusCode());
        assertEquals(tokenB, cookieValue(replay));
        assertEquals(200, refresh(client, base, tokenB).statusCode());
    }

    @Test
    void oldCommittedSigningKeyDoesNotAuthenticateAnAccessToken() throws Exception {
        HttpClient client = HttpClient.newHttpClient();
        String oldSecret = "local-only-secret-key-for-warrantyvault-mvp";
        Instant now = clock.instant();
        String token = Jwts.builder().subject("unknown-id").issuedAt(Date.from(now))
            .expiration(Date.from(now.plusSeconds(600)))
            .signWith(Keys.hmacShaKeyFor(oldSecret.getBytes(StandardCharsets.UTF_8))).compact();
        HttpResponse<String> response = client.send(HttpRequest.newBuilder()
            .uri(URI.create("http://localhost:" + port + "/api/me"))
            .header("Authorization", "Bearer " + token)
            .GET().build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(401, response.statusCode());
    }

    private String register(HttpClient client, String base, String email) throws Exception {
        HttpResponse<String> response = client.send(HttpRequest.newBuilder()
            .uri(URI.create(base + "/api/auth/register"))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString("{\"name\":\"Refresh Test\",\"email\":\"" + email
                + "\",\"password\":\"SafeRefreshPassword123!\",\"timezone\":\"UTC\"}"))
            .build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(201, response.statusCode(), response.body());
        return cookieValue(response);
    }

    private HttpResponse<String> refresh(HttpClient client, String base, String token) throws Exception {
        return client.send(HttpRequest.newBuilder().uri(URI.create(base + "/api/auth/refresh"))
            .header("Content-Type", "application/json")
            .header("X-Requested-With", "warrantyvault")
            .header("Cookie", "wv_refresh=" + token)
            .POST(HttpRequest.BodyPublishers.ofString("{}"))
            .build(), HttpResponse.BodyHandlers.ofString());
    }

    private String cookieValue(HttpResponse<?> response) {
        return response.headers().firstValue("Set-Cookie").orElseThrow()
            .split(";", 2)[0].substring("wv_refresh=".length());
    }

    private String hash(String raw) throws Exception {
        return java.util.HexFormat.of().formatHex(
            java.security.MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8)));
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class MutableClockConfiguration {
        @Bean
        @Primary
        MutableClock mutableClock() {
            return new MutableClock(START);
        }
    }

    static class MutableClock extends Clock {
        private final AtomicReference<Instant> instant;

        MutableClock(Instant instant) {
            this.instant = new AtomicReference<>(instant);
        }

        void advance(Duration duration) {
            instant.updateAndGet(value -> value.plus(duration));
        }

        @Override public ZoneId getZone() { return ZoneId.of("UTC"); }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return instant.get(); }
    }
}
