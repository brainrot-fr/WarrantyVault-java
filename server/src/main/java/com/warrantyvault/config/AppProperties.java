package com.warrantyvault.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
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
    private Storage storage = new Storage();
    private Cookie cookie = new Cookie();
    private Integer maxUploadBytes = 10 * 1024 * 1024;
    @Min(1) @Max(365) private int expiringSoonDays = 30;

    @Data
    public static class Storage {
        private String localDir = "./uploads";
    }

    @Data
    public static class Cookie {
        private String sameSite = "Lax";
    }
}
