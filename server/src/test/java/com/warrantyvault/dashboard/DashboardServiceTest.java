package com.warrantyvault.dashboard;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.warrantyvault.member.SpaceMember;
import com.warrantyvault.product.Product;
import com.warrantyvault.product.ProductRepository;
import com.warrantyvault.product.CurrencyValueTotal;
import com.warrantyvault.product.DashboardCounts;
import com.warrantyvault.config.AppProperties;
import com.warrantyvault.space.Space;
import com.warrantyvault.user.User;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;

class DashboardServiceTest {
    @Test
    void coveredValueExcludesExpiredProducts() {
        User user = new User();
        user.setId("viewer");
        user.setTimezone("UTC");
        Space space = new Space();
        space.setId("space");
        space.setName("Home");
        SpaceMember membership = new SpaceMember();
        membership.setSpace(space);
        membership.setUser(user);

        Product current = product("active", space, LocalDate.parse("2026-10-02"), "5000.00");
        Product expired = product("expired", space, LocalDate.parse("2026-09-30"), "9000.00");
        ProductRepository products = mock(ProductRepository.class);
        when(products.findDashboardCounts(user.getId(), LocalDate.parse("2026-10-01"), LocalDate.parse("2026-10-31")))
            .thenReturn(new DashboardCounts(0L, 1L, 1L));
        when(products.findUpcomingForDashboard(org.mockito.ArgumentMatchers.eq(user.getId()),
            org.mockito.ArgumentMatchers.eq(LocalDate.parse("2026-10-01")), org.mockito.ArgumentMatchers.any()))
            .thenReturn(List.of(current));
        when(products.findRecentlyExpiredForDashboard(org.mockito.ArgumentMatchers.eq(user.getId()),
            org.mockito.ArgumentMatchers.eq(LocalDate.parse("2026-07-03")),
            org.mockito.ArgumentMatchers.eq(LocalDate.parse("2026-09-30")),
            org.mockito.ArgumentMatchers.any())).thenReturn(List.of(expired));
        when(products.findCoveredValueTotals(user.getId(), LocalDate.parse("2026-10-01")))
            .thenReturn(List.of(new CurrencyValueTotal("INR", new BigDecimal("5000.00"))));
        DashboardService service = new DashboardService(products, new AppProperties(),
            Clock.fixed(Instant.parse("2026-10-01T12:00:00Z"), ZoneOffset.UTC));

        assertEquals("5000.00", service.getDashboard(user).totalCoveredValue().get("INR"));
    }

    private Product product(String id, Space space, LocalDate expiresOn, String price) {
        Product product = new Product();
        product.setId(id);
        product.setSpace(space);
        product.setProductType("Refrigerator");
        product.setBrand("LG");
        product.setCurrency("INR");
        product.setPurchasePrice(new BigDecimal(price));
        product.setExpiresOn(expiresOn);
        return product;
    }
}
