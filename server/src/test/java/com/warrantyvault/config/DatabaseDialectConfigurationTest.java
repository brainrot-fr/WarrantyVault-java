package com.warrantyvault.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class DatabaseDialectConfigurationTest {
    @Test
    void selectsMariaDbDialectWhenProductVersionIdentifiesMariaDb() {
        assertEquals(
            "org.hibernate.dialect.MariaDBDialect",
            DatabaseDialectConfiguration.dialectFor("MySQL", "13.0.2-MariaDB").orElseThrow());
    }

    @Test
    void selectsMySqlDialectForMySql() {
        assertEquals(
            "org.hibernate.dialect.MySQLDialect",
            DatabaseDialectConfiguration.dialectFor("MySQL", "8.4.0").orElseThrow());
    }

    @Test
    void leavesOtherDatabaseDialectsToHibernate() {
        assertTrue(DatabaseDialectConfiguration.dialectFor("H2", "2.3.232").isEmpty());
    }
}
