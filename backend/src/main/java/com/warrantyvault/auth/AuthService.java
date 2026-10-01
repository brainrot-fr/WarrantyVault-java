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
import lombok.RequiredArgsConstructor;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import jakarta.servlet.http.HttpServletResponse;

@Service
@RequiredArgsConstructor
public class AuthService {
    private static final long REFRESH_TOKEN_TTL_SECONDS = 30L * 24 * 60 * 60;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final String DEV_JWT_SECRET = "dev-secret-key-1234567890-abcdef";

    private final JwtService jwtService;
    private final RefreshTokenRepository refreshTokenRepository;
    private final AppProperties appProperties;
    private final Environment environment;
    private final Clock clock;

    public String issueAccessToken(User user) {
        return jwtService.generateAccessToken(user.getId(), user.getEmail());
    }

    @Transactional
    public void issueRefreshToken(User user, HttpServletResponse response) {
        String raw = newOpaqueToken();
        Instant now = Instant.now(clock);
        RefreshToken token = new RefreshToken();
        token.setId(UUID.randomUUID().toString());
        token.setUser(user);
        token.setTokenHash(sha256(raw));
        token.setFamilyId(UUID.randomUUID().toString());
        token.setExpiresAt(now.plusSeconds(REFRESH_TOKEN_TTL_SECONDS));
        token.setCreatedAt(now);
        refreshTokenRepository.save(token);
        writeRefreshCookie(response, raw, REFRESH_TOKEN_TTL_SECONDS);
    }

    @Transactional
    public User refreshSession(String rawToken, HttpServletResponse response) {
        Instant now = Instant.now(clock);
        RefreshToken token = refreshTokenRepository.findByTokenHashForUpdate(sha256(rawToken))
            .orElseThrow(() -> invalidRefreshToken());
        if (token.getRevokedAt() != null) {
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
        refreshTokenRepository.save(newToken);
        token.setRevokedAt(now);
        token.setReplacedBy(newToken.getId());
        refreshTokenRepository.save(token);
        writeRefreshCookie(response, newRaw, REFRESH_TOKEN_TTL_SECONDS);
        return user;
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
            .path("/api/auth")
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
