package com.warrantyvault.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.warrantyvault.common.ApiException;
import com.warrantyvault.config.AppProperties;
import com.warrantyvault.security.JwtService;
import com.warrantyvault.security.RefreshToken;
import com.warrantyvault.security.RefreshTokenRepository;
import com.warrantyvault.user.User;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.mock.web.MockHttpServletResponse;

class AuthServiceTest {
    private final RefreshTokenRepository tokenRepository = mock(RefreshTokenRepository.class);
    private final AuthService service = new AuthService(
        mock(JwtService.class),
        tokenRepository,
        new AppProperties(),
        new MockEnvironment(),
        Clock.fixed(Instant.parse("2025-01-01T00:00:00Z"), ZoneOffset.UTC)
    );

    @Test
    void issuesOpaqueHashedRefreshTokenInHttpOnlySameSiteCookie() {
        List<RefreshToken> savedTokens = new ArrayList<>();
        when(tokenRepository.save(any(RefreshToken.class))).thenAnswer(call -> {
            RefreshToken token = call.getArgument(0);
            savedTokens.add(token);
            return token;
        });
        MockHttpServletResponse response = new MockHttpServletResponse();

        service.issueRefreshToken(user(), response, "Test browser");

        String rawToken = cookieValue(response);
        assertNotNull(rawToken);
        assertEquals(64, savedTokens.getFirst().getTokenHash().length());
        assertEquals(service.sha256(rawToken), savedTokens.getFirst().getTokenHash());
        assertNotEquals(rawToken, savedTokens.getFirst().getTokenHash());
        String cookie = response.getHeader("Set-Cookie");
        org.junit.jupiter.api.Assertions.assertTrue(cookie.contains("HttpOnly"));
        org.junit.jupiter.api.Assertions.assertTrue(cookie.contains("Path=/api"));
        org.junit.jupiter.api.Assertions.assertTrue(cookie.contains("SameSite=Lax"));
        assertEquals("Test browser", savedTokens.getFirst().getUserAgent());
    }

    @Test
    void rotatesTokenWithinItsFamilyAndRevokesThePreviousToken() {
        String rawToken = "previous-opaque-token";
        RefreshToken previous = token("previous-id", "family-id", rawToken);
        when(tokenRepository.findByTokenHashForUpdate(service.sha256(rawToken))).thenReturn(Optional.of(previous));
        when(tokenRepository.save(any(RefreshToken.class))).thenAnswer(call -> call.getArgument(0));
        MockHttpServletResponse response = new MockHttpServletResponse();

        User refreshedUser = service.refreshSession(rawToken, response);

        String replacementRaw = cookieValue(response);
        assertEquals(user().getId(), refreshedUser.getId());
        assertNotEquals(rawToken, replacementRaw);
        assertEquals("family-id", previous.getFamilyId());
        assertEquals(Instant.parse("2025-01-01T00:00:00Z"), previous.getRevokedAt());
        assertNotNull(previous.getReplacedBy());
        verify(tokenRepository).save(previous);
    }

    @Test
    void repeatsRecentRefreshRotationDuringGraceWindowWithoutRevokingFamily() {
        String rawToken = "previous-opaque-token";
        RefreshToken previous = token("previous-id", "family-id", rawToken);
        when(tokenRepository.findByTokenHashForUpdate(service.sha256(rawToken))).thenReturn(Optional.of(previous));
        when(tokenRepository.save(any(RefreshToken.class))).thenAnswer(call -> call.getArgument(0));
        MockHttpServletResponse firstResponse = new MockHttpServletResponse();
        service.refreshSession(rawToken, firstResponse);
        String replacement = cookieValue(firstResponse);

        MockHttpServletResponse replayResponse = new MockHttpServletResponse();
        User replayedUser = service.refreshSession(rawToken, replayResponse);

        assertEquals(user().getId(), replayedUser.getId());
        assertEquals(replacement, cookieValue(replayResponse));
        org.mockito.Mockito.verify(tokenRepository, org.mockito.Mockito.never()).findByFamilyId("family-id");
    }

    @Test
    void presentingRevokedTokenRevokesItsEntireFamily() {
        RefreshToken reused = token("reused-id", "family-id", "reused-token");
        reused.setRevokedAt(Instant.parse("2024-12-31T23:00:00Z"));
        RefreshToken stillActive = token("active-id", "family-id", "active-token");
        when(tokenRepository.findByTokenHashForUpdate(service.sha256("reused-token"))).thenReturn(Optional.of(reused));
        when(tokenRepository.findByFamilyId("family-id")).thenReturn(List.of(reused, stillActive));

        assertThrows(ApiException.class, () -> service.refreshSession("reused-token", new MockHttpServletResponse()));

        assertEquals(Instant.parse("2025-01-01T00:00:00Z"), stillActive.getRevokedAt());
        verify(tokenRepository).saveAll(List.of(reused, stillActive));
    }

    private RefreshToken token(String id, String familyId, String rawValue) {
        RefreshToken token = new RefreshToken();
        token.setId(id);
        token.setUser(user());
        token.setTokenHash(service.sha256(rawValue));
        token.setFamilyId(familyId);
        token.setExpiresAt(Instant.parse("2025-02-01T00:00:00Z"));
        token.setCreatedAt(Instant.parse("2024-12-01T00:00:00Z"));
        return token;
    }

    private User user() {
        User user = new User();
        user.setId("user-id");
        user.setEmail("person@example.test");
        user.setName("Person");
        return user;
    }

    private String cookieValue(MockHttpServletResponse response) {
        String cookie = response.getHeader("Set-Cookie");
        return cookie.substring("wv_refresh=".length(), cookie.indexOf(';'));
    }
}
