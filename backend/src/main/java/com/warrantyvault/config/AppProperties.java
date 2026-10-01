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
    @NotBlank private String jwtSecret;
    @NotBlank private String corsAllowedOrigins;
    private Storage storage = new Storage();
    private Cookie cookie = new Cookie();
    private Integer maxUploadBytes = 10 * 1024 * 1024;

    @Data
    public static class Storage {
        private String localDir = "./uploads";
    }

    @Data
    public static class Cookie {
        private String sameSite = "Lax";
        private String domain = "";
    }

    public String[] getAllowedOrigins() {
        return corsAllowedOrigins == null ? new String[0] : corsAllowedOrigins.split(",");
    }
}
