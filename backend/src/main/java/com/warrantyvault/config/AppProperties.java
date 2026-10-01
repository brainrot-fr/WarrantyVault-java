package com.warrantyvault.config;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.validation.annotation.Validated;

@Data
@Component
@Validated
@ConfigurationProperties(prefix = "app")
public class AppProperties {
    @NotBlank private String appBaseUrl;
    @NotBlank private String cronSecret;
    @NotBlank private String jwtSecret;
    @NotBlank private String corsAllowedOrigins;
    private Storage storage = new Storage();
    private Mail mail = new Mail();
    private Cookie cookie = new Cookie();
    private Reminders reminders = new Reminders();
    private Cloudinary cloudinary = new Cloudinary();
    private Brevo brevo = new Brevo();
    private Integer maxUploadBytes = 10 * 1024 * 1024;

    @Data
    public static class Storage {
        private String localDir = "./uploads";
    }

    @Data
    public static class Mail {
        private String from = "no-reply@warrantyvault.local";
    }

    @Data
    public static class Cookie {
        private String sameSite = "Lax";
        private String domain = "";
    }

    @Data
    public static class Reminders {
        private boolean internalSchedulerEnabled = true;
    }

    @Data
    public static class Cloudinary {
        private String cloudName = "";
        private String apiKey = "";
        private String apiSecret = "";
        public boolean isConfigured() { return cloudName != null && !cloudName.isBlank() && apiKey != null && !apiKey.isBlank() && apiSecret != null && !apiSecret.isBlank(); }
    }

    @Data
    public static class Brevo {
        private String apiKey = "";
        private String sender = "";
    }

    public String[] getAllowedOrigins() {
        return corsAllowedOrigins == null ? new String[0] : corsAllowedOrigins.split(",");
    }
}
