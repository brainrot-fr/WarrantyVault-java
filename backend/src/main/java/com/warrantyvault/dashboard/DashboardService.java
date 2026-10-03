package com.warrantyvault.dashboard;

import com.warrantyvault.product.Product;
import com.warrantyvault.product.ProductRepository;
import com.warrantyvault.product.CurrencyValueTotal;
import com.warrantyvault.config.AppProperties;
import com.warrantyvault.user.User;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DashboardService {
    private static final int RECENT_EXPIRY_DAYS = 90;
    private static final int UPCOMING_LIMIT = 50;
    private static final int RECENTLY_EXPIRED_LIMIT = 20;

    private final ProductRepository productRepository;
    private final AppProperties appProperties;
    private final Clock clock;

    public DashboardService(ProductRepository productRepository, AppProperties appProperties, Clock clock) {
        this.productRepository = productRepository;
        this.appProperties = appProperties;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public DashboardResponse getDashboard(User user) {
        ZoneId zone = ZoneId.of(user.getTimezone());
        LocalDate today = LocalDate.now(clock.withZone(zone));
        int thresholdDays = appProperties.getExpiringSoonDays();

        List<Product> products = productRepository.findAllForDashboard(user.getId());

        int active = 0;
        int expiringSoon = 0;
        int expired = 0;
        List<ProductSummary> upcoming = new ArrayList<>();
        List<ProductSummary> recentlyExpired = new ArrayList<>();

        for (Product product : products) {
            long daysRemaining = ChronoUnit.DAYS.between(today, product.getExpiresOn());
            String status = daysRemaining < 0 ? "EXPIRED"
                : daysRemaining <= thresholdDays ? "EXPIRING_SOON" : "ACTIVE";
            switch (status) {
                case "ACTIVE" -> active++;
                case "EXPIRING_SOON" -> expiringSoon++;
                default -> expired++;
            }
            ProductSummary summary = new ProductSummary(
                product.getId(),
                product.getSpace().getId(),
                product.getSpace().getName(),
                product.getProductType(),
                product.getBrand(),
                product.getExpiresOn(),
                daysRemaining,
                status
            );
            if (daysRemaining >= 0) upcoming.add(summary);
            else if (daysRemaining >= -RECENT_EXPIRY_DAYS) recentlyExpired.add(summary);
        }

        Comparator<ProductSummary> expiryOrder = Comparator.comparing(ProductSummary::expiresOn)
            .thenComparing(ProductSummary::productType)
            .thenComparing(ProductSummary::brand);
        upcoming.sort(expiryOrder);
        recentlyExpired.sort(Comparator.comparingLong(ProductSummary::daysRemaining).reversed());

        Map<String, String> coveredValue = new LinkedHashMap<>();
        for (CurrencyValueTotal total : productRepository.findCoveredValueTotals(user.getId(), today)) {
            coveredValue.put(total.currency(), total.amount().setScale(2, RoundingMode.HALF_UP).toPlainString());
        }

        return new DashboardResponse(
            new Counts(active, expiringSoon, expired),
            thresholdDays,
            List.copyOf(upcoming.subList(0, Math.min(upcoming.size(), UPCOMING_LIMIT))),
            List.copyOf(recentlyExpired.subList(0, Math.min(recentlyExpired.size(), RECENTLY_EXPIRED_LIMIT))),
            coveredValue
        );
    }

    public record Counts(int active, int expiringSoon, int expired) {}

    public record ProductSummary(
        String id,
        String spaceId,
        String spaceName,
        String productType,
        String brand,
        LocalDate expiresOn,
        long daysRemaining,
        String status
    ) {}

    public record DashboardResponse(
        Counts counts,
        int thresholdDays,
        List<ProductSummary> upcoming,
        List<ProductSummary> recentlyExpired,
        Map<String, String> totalCoveredValue
    ) {}
}
