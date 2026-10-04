package com.warrantyvault.config;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import org.springframework.beans.factory.config.BeanFactoryPostProcessor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.ConfigurableEnvironment;

@Configuration
@Profile("prod")
public class ProductionConfigurationValidator {
    private static final String DEVELOPMENT_JWT_SECRET = "dev-secret-key-1234567890-abcdef";

    @Bean
    static BeanFactoryPostProcessor validateProductionConfiguration(ConfigurableEnvironment environment) {
        List<String> required = List.of(
            "DB_URL", "DB_USER", "DB_PASSWORD", "JWT_SECRET", "CORS_ALLOWED_ORIGINS"
        );
        List<String> absent = required.stream()
            .filter(name -> environment.getProperty(name) == null || environment.getProperty(name).isBlank())
            .toList();
        List<String> invalid = new ArrayList<>();
        String jwtSecret = environment.getProperty("JWT_SECRET");
        if (jwtSecret != null && !jwtSecret.isBlank()) {
            if (jwtSecret.getBytes(StandardCharsets.UTF_8).length < 32) invalid.add("JWT_SECRET (must be at least 32 bytes)");
            if (DEVELOPMENT_JWT_SECRET.equals(jwtSecret)) invalid.add("JWT_SECRET (development value is prohibited)");
        }
        String origins = environment.getProperty("CORS_ALLOWED_ORIGINS");
        if (origins != null && (origins.isBlank() || origins.contains("*"))) {
            invalid.add("CORS_ALLOWED_ORIGINS (must contain explicit origins, not '*')");
        }
        String sameSite = environment.getProperty("COOKIE_SAMESITE", "Lax");
        if (!List.of("Lax", "Strict", "None").contains(sameSite)) invalid.add("COOKIE_SAMESITE (must be Lax, Strict, or None)");
        return beanFactory -> {
            if (!absent.isEmpty() || !invalid.isEmpty()) {
                List<String> errors = new ArrayList<>();
                if (!absent.isEmpty()) errors.add("missing: " + String.join(", ", absent));
                if (!invalid.isEmpty()) errors.add("invalid: " + String.join(", ", invalid));
                throw new IllegalStateException("Production configuration is incomplete (" + String.join("; ", errors) + ")");
            }
        };
    }
}
