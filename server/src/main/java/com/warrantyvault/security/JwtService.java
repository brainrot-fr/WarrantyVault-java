package com.warrantyvault.security;

import com.warrantyvault.config.AppProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.Clock;
import java.util.Date;
import javax.crypto.SecretKey;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class JwtService {
    private final AppProperties appProperties;
    private final Clock clock;
    private SecretKey signingKey;

    @PostConstruct
    void init() {
        this.signingKey = Keys.hmacShaKeyFor(appProperties.getJwtSecret().getBytes(StandardCharsets.UTF_8));
    }

    public String generateAccessToken(String userId, String email) {
        Instant now = Instant.now(clock);
        return Jwts.builder()
            .subject(userId)
            .claim("email", email)
            .issuedAt(Date.from(now))
            .expiration(Date.from(now.plusSeconds(30 * 60)))
            .signWith(signingKey)
            .compact();
    }

    public String getUserId(String token) {
        return getClaims(token).getPayload().getSubject();
    }

    private Jws<Claims> getClaims(String token) {
        return Jwts.parser().verifyWith(signingKey).build().parseSignedClaims(token);
    }

    public boolean isValid(String token) {
        try {
            Jws<Claims> claims = getClaims(token);
            return claims.getPayload().getExpiration().after(Date.from(Instant.now(clock)));
        } catch (Exception e) {
            return false;
        }
    }

    public Claims parseClaims(String token) {
        return getClaims(token).getPayload();
    }
}
