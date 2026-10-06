package com.warrantyvault.config;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;

class AppPropertiesSecretTest {
    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
        .withUserConfiguration(PropertiesConfiguration.class);

    @Test
    void refusesBlankJwtSecret() {
        assertInvalidSecret("");
    }

    @Test
    void refusesCommittedJwtSecret() {
        assertInvalidSecret("local-only-secret-key-for-warrantyvault-mvp");
    }

    @Test
    void refusesShortJwtSecret() {
        assertInvalidSecret("short");
    }

    private void assertInvalidSecret(String secret) {
        contextRunner.withPropertyValues("app.jwt-secret=" + secret).run(context -> {
            Throwable failure = context.getStartupFailure();
            assertNotNull(failure);
            assertTrue(rootMessage(failure).contains("APP_JWT_SECRET must be set"));
        });
    }

    private String rootMessage(Throwable error) {
        Throwable current = error;
        while (current.getCause() != null) current = current.getCause();
        return current.getMessage();
    }

    @Configuration(proxyBeanMethods = false)
    @EnableConfigurationProperties(AppProperties.class)
    static class PropertiesConfiguration {}
}
