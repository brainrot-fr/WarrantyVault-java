package com.warrantyvault;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import com.warrantyvault.config.AppProperties;
import org.springframework.beans.factory.annotation.Value;

@SpringBootApplication
@EnableScheduling
public class WarrantyVaultApplication {
    private static final Logger logger = LoggerFactory.getLogger(WarrantyVaultApplication.class);

    public static void main(String[] args) {
        SpringApplication.run(WarrantyVaultApplication.class, args);
    }

    @Bean
    ApplicationRunner cookieSecurityWarning(AppProperties properties, @Value("${server.address:}") String address) {
        return args -> {
            if (!properties.getCookie().isSecure()
                && !("127.0.0.1".equals(address) || "localhost".equalsIgnoreCase(address) || "::1".equals(address))) {
                logger.warn("Refresh cookies are not Secure while the server listens on a non-loopback address");
            }
        };
    }
}
