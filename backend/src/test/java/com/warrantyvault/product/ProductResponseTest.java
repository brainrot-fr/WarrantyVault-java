package com.warrantyvault.product;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.warrantyvault.space.Space;
import com.warrantyvault.space.SpaceRole;
import com.warrantyvault.user.User;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class ProductResponseTest {
    @Test
    void keepsCoverageValidThroughExpiryAndAppliesReminderBoundary() {
        Product product = product("2025-01-01", "2025-02-01", 1);

        ProductResponse onExpiryDay = ProductResponse.from(product, SpaceRole.EDITOR, LocalDate.parse("2025-02-01"), 30);
        ProductResponse oneDayPastExpiry = ProductResponse.from(product, SpaceRole.VIEWER, LocalDate.parse("2025-02-02"), 30);

        assertEquals("EXPIRING_SOON", onExpiryDay.status());
        assertEquals(0, onExpiryDay.daysRemaining());
        assertEquals("EXPIRED", oneDayPastExpiry.status());
        assertEquals(-1, oneDayPastExpiry.daysRemaining());
        assertEquals(false, onExpiryDay.permissions().canDelete());
        assertEquals(false, oneDayPastExpiry.permissions().canEdit());
    }

    @Test
    void marksTheInclusiveReminderThresholdAndClampsElapsedFraction() {
        Product product = product("2024-01-01", "2025-01-01", 12);

        ProductResponse atThreshold = ProductResponse.from(product, SpaceRole.OWNER, LocalDate.parse("2024-12-02"), 30);
        ProductResponse beforePurchase = ProductResponse.from(product, SpaceRole.OWNER, LocalDate.parse("2023-12-31"), 30);
        ProductResponse afterExpiry = ProductResponse.from(product, SpaceRole.OWNER, LocalDate.parse("2025-02-01"), 30);

        assertEquals("EXPIRING_SOON", atThreshold.status());
        assertEquals(30, atThreshold.daysRemaining());
        assertEquals(0, beforePurchase.warrantyElapsedFraction());
        assertEquals(1, afterExpiry.warrantyElapsedFraction());
    }

    private Product product(String purchasedOn, String expiresOn, int warrantyMonths) {
        User owner = new User();
        owner.setId("user-id");
        owner.setName("Owner");
        Space space = new Space();
        space.setId("space-id");
        space.setName("Home");
        Product product = new Product();
        product.setId("product-id");
        product.setSpace(space);
        product.setCreatedBy(owner);
        product.setProductType("Refrigerator");
        product.setBrand("LG");
        product.setPurchasedOn(LocalDate.parse(purchasedOn));
        product.setWarrantyMonths(warrantyMonths);
        product.setExpiresOn(LocalDate.parse(expiresOn));
        product.setPurchasePrice(new BigDecimal("120.00"));
        product.setCurrency("INR");
        product.setBillContentType("image/png");
        product.setBillSizeBytes(128L);
        product.setCreatedAt(Instant.parse("2025-01-01T00:00:00Z"));
        product.setUpdatedAt(Instant.parse("2025-01-01T00:00:00Z"));
        return product;
    }
}
