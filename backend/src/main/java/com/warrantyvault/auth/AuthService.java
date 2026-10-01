package com.warrantyvault.auth;

import com.warrantyvault.common.ApiException;
import com.warrantyvault.config.AppProperties;
import com.warrantyvault.security.JwtService;
import com.warrantyvault.security.RefreshToken;
import com.warrantyvault.security.RefreshTokenRepository;
import com.warrantyvault.user.User;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import lombok.RequiredArgsConstructor;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.scheduling.annotation.Scheduled;
import jakarta.servlet.http.HttpServletResponse;

@Service
@RequiredArgsConstructor
public class AuthService {
    private static final long REFRESH_TOKEN_TTL_SECONDS = 30L * 24 * 60 * 60;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final String DEV_JWT_SECRET = "dev-secret-key-1234567890-abcdef";
    private static final long ROTATION_GRACE_SECONDS = 15;

    private final JwtService jwtService;
    private final RefreshTokenRepository refreshTokenRepository;
    private final AppProperties appProperties;
    private final Environment environment;
    private final Clock clock;
    private final ConcurrentHashMap<String, GraceToken> graceTokens = new ConcurrentHashMap<>();

    public String issueAccessToken(User user) {
        return jwtService.generateAccessToken(user.getId(), user.getEmail());
    }

    @Transactional
    public void issueRefreshToken(User user, HttpServletResponse response) {
        issueRefreshToken(user, response, null);
    }

    @Transactional
    public void issueRefreshToken(User user, HttpServletResponse response, String userAgent) {
        String raw = newOpaqueToken();
        Instant now = Instant.now(clock);
        RefreshToken token = new RefreshToken();
        token.setId(UUID.randomUUID().toString());
        token.setUser(user);
        token.setTokenHash(sha256(raw));
        token.setFamilyId(UUID.randomUUID().toString());
        token.setExpiresAt(now.plusSeconds(REFRESH_TOKEN_TTL_SECONDS));
        token.setCreatedAt(now);
        token.setUserAgent(normalizeUserAgent(userAgent));
        refreshTokenRepository.save(token);
        writeRefreshCookie(response, raw, REFRESH_TOKEN_TTL_SECONDS);
    }

    @Transactional
    public User refreshSession(String rawToken, HttpServletResponse response) {
        return refreshSession(rawToken, response, null);
    }

    @Transactional
    public User refreshSession(String rawToken, HttpServletResponse response, String userAgent) {
        Instant now = Instant.now(clock);
        String tokenHash = sha256(rawToken);
        graceTokens.entrySet().removeIf(entry -> !entry.getValue().expiresAt().isAfter(now));
        RefreshToken token = refreshTokenRepository.findByTokenHashForUpdate(tokenHash)
            .orElseThrow(() -> invalidRefreshToken());
        if (token.getRevokedAt() != null) {
            GraceToken grace = graceTokens.get(tokenHash);
            if (token.getReplacedBy() != null
                && token.getRevokedAt().plusSeconds(ROTATION_GRACE_SECONDS).isAfter(now)
                && grace != null && grace.expiresAt().isAfter(now)) {
                writeRefreshCookie(response, grace.rawToken(), REFRESH_TOKEN_TTL_SECONDS);
                return token.getUser();
            }
            revokeFamily(token.getFamilyId(), now);
            throw invalidRefreshToken();
        }
        if (!token.getExpiresAt().isAfter(now)) {
            throw invalidRefreshToken();
        }

        User user = token.getUser();
        String newRaw = newOpaqueToken();
        RefreshToken newToken = new RefreshToken();
        newToken.setId(UUID.randomUUID().toString());
        newToken.setUser(user);
        newToken.setTokenHash(sha256(newRaw));
        newToken.setFamilyId(token.getFamilyId());
        newToken.setExpiresAt(now.plusSeconds(REFRESH_TOKEN_TTL_SECONDS));
        newToken.setCreatedAt(now);
        newToken.setUserAgent(normalizeUserAgent(userAgent));
        refreshTokenRepository.save(newToken);
        token.setRevokedAt(now);
        token.setReplacedBy(newToken.getId());
        refreshTokenRepository.save(token);
        graceTokens.put(tokenHash, new GraceToken(newRaw, now.plusSeconds(ROTATION_GRACE_SECONDS)));
        writeRefreshCookie(response, newRaw, REFRESH_TOKEN_TTL_SECONDS);
        return user;
    }

    @Transactional
    public void revokeOtherRefreshFamilies(String userId, String currentRawToken) {
        RefreshToken current = refreshTokenRepository.findByTokenHashForUpdate(sha256(currentRawToken))
            .filter(token -> token.getUser().getId().equals(userId))
            .filter(token -> token.getRevokedAt() == null && token.getExpiresAt().isAfter(Instant.now(clock)))
            .orElseThrow(this::invalidRefreshToken);
        Instant now = Instant.now(clock);
        List<RefreshToken> tokens = refreshTokenRepository.findByUserId(userId);
        tokens.stream()
            .filter(token -> !token.getFamilyId().equals(current.getFamilyId()) && token.getRevokedAt() == null)
            .forEach(token -> token.setRevokedAt(now));
        refreshTokenRepository.saveAll(tokens);
    }

    @Scheduled(cron = "0 15 3 * * *")
    @Transactional
    public void cleanExpiredTokens() {
        Instant cutoff = Instant.now(clock).minusSeconds(REFRESH_TOKEN_TTL_SECONDS);
        refreshTokenRepository.deleteByExpiresAtBeforeOrRevokedAtBefore(cutoff, cutoff);
        graceTokens.entrySet().removeIf(entry -> !entry.getValue().expiresAt().isAfter(Instant.now(clock)));
    }

    @Transactional
    public void logout(String rawToken, HttpServletResponse response) {
        if (rawToken != null && !rawToken.isBlank()) {
            refreshTokenRepository.findByTokenHashForUpdate(sha256(rawToken)).ifPresent(token -> {
                Instant now = Instant.now(clock);
                revokeFamily(token.getFamilyId(), now);
            });
        }
        writeRefreshCookie(response, "", 0);
    }

    private void revokeFamily(String familyId, Instant revokedAt) {
        List<RefreshToken> family = refreshTokenRepository.findByFamilyId(familyId);
        family.forEach(token -> {
            if (token.getRevokedAt() == null) token.setRevokedAt(revokedAt);
        });
        refreshTokenRepository.saveAll(family);
    }

    private void writeRefreshCookie(HttpServletResponse response, String value, long maxAgeSeconds) {
        boolean secure = environment.matchesProfiles("prod");
        ResponseCookie.ResponseCookieBuilder builder = ResponseCookie.from("wv_refresh", value)
            .httpOnly(true)
            .secure(secure)
            .path("/api")
            .sameSite(appProperties.getCookie().getSameSite())
            .maxAge(maxAgeSeconds);
        String domain = appProperties.getCookie().getDomain();
        if (domain != null && !domain.isBlank()) builder.domain(domain);
        response.addHeader("Set-Cookie", builder.build().toString());
    }

    private String newOpaqueToken() {
        byte[] bytes = new byte[32];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String normalizeUserAgent(String userAgent) {
        if (userAgent == null || userAgent.isBlank()) return null;
        return userAgent.substring(0, Math.min(255, userAgent.length()));
    }

    private record GraceToken(String rawToken, Instant expiresAt) {}

    private ApiException invalidRefreshToken() {
        return new ApiException("INVALID_CREDENTIALS", "Invalid refresh token", HttpStatus.UNAUTHORIZED.value());
    }

    public String sha256(String input) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(input.getBytes(StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is unavailable", e);
        }
    }
}
