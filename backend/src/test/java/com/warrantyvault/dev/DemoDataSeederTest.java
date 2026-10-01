package com.warrantyvault.dev;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;

class DemoDataSeederTest {
    @Test
    void seededPurchaseDatesArePastAndExpiryMatchesWarrantyPeriod() {
        LocalDate today = LocalDate.parse("2026-10-01");
        var products = Stream.concat(DemoDataSeeder.homeProducts().stream(), DemoDataSeeder.farmhouseProducts().stream()).toList();

        for (DemoDataSeeder.SeedProduct product : products) {
            LocalDate targetExpiry = today.plusDays(product.expiryOffsetDays());
            LocalDate purchasedOn = targetExpiry.minusMonths(product.warrantyMonths());
            LocalDate expiresOn = purchasedOn.plusMonths(product.warrantyMonths());

            assertFalse(purchasedOn.isAfter(today), product.type() + " purchase date is in the future");
            assertEquals(expiresOn, purchasedOn.plusMonths(product.warrantyMonths()));
            assertTrue(Math.abs(ChronoUnit.DAYS.between(targetExpiry, expiresOn)) <= 1);
        }

        assertTrue(products.stream().anyMatch(product -> product.expiryOffsetDays() == 10));
        assertTrue(products.stream().anyMatch(product -> product.expiryOffsetDays() == 25));
        assertTrue(products.stream().anyMatch(product -> product.expiryOffsetDays() < 0));
    }
}
