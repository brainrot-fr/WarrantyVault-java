package com.warrantyvault.config;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

class ProductionConfigurationValidatorTest {
    @Test
    void acceptsCompleteProductionConfiguration() {
        MockEnvironment environment = validEnvironment();

        assertDoesNotThrow(() ->
            ProductionConfigurationValidator.validateProductionConfiguration(environment)
                .postProcessBeanFactory(null)
        );
    }

    @Test
    void rejectsDevelopmentJwtSecret() {
        MockEnvironment environment = new MockEnvironment()
            .withProperty("DB_URL", "jdbc:mysql://localhost/warrantyvault")
            .withProperty("DB_USER", "warrantyvault")
            .withProperty("DB_PASSWORD", "password")
            .withProperty("JWT_SECRET", "dev-secret-key-1234567890-abcdef")
            .withProperty("CORS_ALLOWED_ORIGINS", "https://warrantyvault.example");

        assertThrows(IllegalStateException.class, () ->
            ProductionConfigurationValidator.validateProductionConfiguration(environment)
                .postProcessBeanFactory(null)
        );
    }

    private MockEnvironment validEnvironment() {
        return new MockEnvironment()
            .withProperty("DB_URL", "jdbc:mysql://localhost/warrantyvault")
            .withProperty("DB_USER", "warrantyvault")
            .withProperty("DB_PASSWORD", "password")
            .withProperty("JWT_SECRET", "production-secret-that-is-at-least-32-bytes")
            .withProperty("CORS_ALLOWED_ORIGINS", "https://warrantyvault.example");
    }
}
