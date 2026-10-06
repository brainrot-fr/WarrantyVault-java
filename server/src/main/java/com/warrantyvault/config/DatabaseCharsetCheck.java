package com.warrantyvault.config;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.SQLException;
import javax.sql.DataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class DatabaseCharsetCheck {
    private static final Logger logger = LoggerFactory.getLogger(DatabaseCharsetCheck.class);

    @Bean
    ApplicationRunner verifyDatabaseCharset(DataSource dataSource) {
        return args -> {
            try (Connection connection = dataSource.getConnection()) {
                DatabaseMetaData metadata = connection.getMetaData();
                String product = metadata.getDatabaseProductName();
                if (!product.contains("MySQL") && !product.contains("MariaDB")) return;
                try (var statement = connection.createStatement();
                     ResultSet tables = statement.executeQuery(
                         "SELECT TABLE_NAME, TABLE_COLLATION FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()")) {
                    while (tables.next()) {
                        String table = tables.getString("TABLE_NAME");
                        String collation = tables.getString("TABLE_COLLATION");
                        if (collation == null || !collation.toLowerCase(java.util.Locale.ROOT).startsWith("utf8mb4")) {
                            logger.error("Table {} does not use utf8mb4. Fix manually with: ALTER TABLE {} CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
                                table, table);
                        }
                    }
                }
            } catch (SQLException exception) {
                logger.error("Could not verify database table collations", exception);
            }
        };
    }
}
