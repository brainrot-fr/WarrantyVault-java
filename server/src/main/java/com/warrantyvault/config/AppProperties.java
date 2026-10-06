package com.warrantyvault.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import jakarta.annotation.PostConstruct;
import java.nio.charset.StandardCharsets;
import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.validation.annotation.Validated;

@Data
@Component
@Validated
@ConfigurationProperties(prefix = "app")
public class AppProperties {
    private String jwtSecret;
    @Valid private Storage storage = new Storage();
    @Valid private Cookie cookie = new Cookie();
    @Min(1) private Integer maxUploadBytes = 10 * 1024 * 1024;
    @Min(1) @Max(365) private int expiringSoonDays = 30;
    @Min(0) @Max(120) private int refreshGraceSeconds = 15;
    private boolean seedDemoData;
    @Valid private RateLimit rateLimit = new RateLimit();

    @Data
    public static class Storage {
        private String provider = "local";
        private String localDir = "./uploads";
        @Min(0) private long maxBytesPerSpace = 2_147_483_648L;
    }

    @Data
    public static class Cookie {
        @Pattern(regexp = "(?i)Lax|Strict|None")
        private String sameSite = "Lax";
        private boolean secure;
    }

    @Data
    public static class RateLimit {
        @Min(1) private int apiPerMinute = 300;
        @Min(1) private int loginPerIp = 30;
        @Min(1) private int loginPerIpEmail = 10;
        @Min(1) private int loginPerAccount = 20;
        @Min(1) private int registerPerHour = 5;
        @Min(1) private int invitationsPerHour = 30;
        @Min(1) private int acceptPerUser = 10;
    }

    @PostConstruct
    void validateJwtSecret() {
        if (jwtSecret == null
            || jwtSecret.getBytes(StandardCharsets.UTF_8).length < 32
            || "local-only-secret-key-for-warrantyvault-mvp".equals(jwtSecret)) {
            throw new IllegalStateException("APP_JWT_SECRET must be set to a secret of at least 32 UTF-8 bytes.");
        }
        if ("None".equalsIgnoreCase(cookie.getSameSite()) && !cookie.isSecure()) {
            throw new IllegalStateException("SameSite=None refresh cookies require APP_COOKIE_SECURE=true.");
        }
    }
}
