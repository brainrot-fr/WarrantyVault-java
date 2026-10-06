package com.warrantyvault.config;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.SQLException;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import javax.sql.DataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.hibernate.autoconfigure.HibernatePropertiesCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
public class DatabaseDialectConfiguration {
    private static final Logger logger = LoggerFactory.getLogger(DatabaseDialectConfiguration.class);

    @Bean
    HibernatePropertiesCustomizer databaseDialectCustomizer(DataSource dataSource) {
        return properties -> {
            try (Connection connection = dataSource.getConnection()) {
                DatabaseMetaData metadata = connection.getMetaData();
                Optional<String> dialect = dialectFor(
                    metadata.getDatabaseProductName(), metadata.getDatabaseProductVersion());
                dialect.ifPresent(name -> {
                    properties.put("hibernate.dialect", name);
                    logger.info("Using Hibernate dialect {}", name);
                });
            } catch (SQLException exception) {
                throw new IllegalStateException("Could not determine the database dialect", exception);
            }
        };
    }

    static Optional<String> dialectFor(String productName, String productVersion) {
        String product = productName.toLowerCase(Locale.ROOT);
        String version = productVersion.toLowerCase(Locale.ROOT);
        if (product.contains("mariadb") || version.contains("mariadb")) {
            return Optional.of("org.hibernate.dialect.MariaDBDialect");
        }
        if (product.contains("mysql")) {
            return Optional.of("org.hibernate.dialect.MySQLDialect");
        }
        return Optional.empty();
    }
}
