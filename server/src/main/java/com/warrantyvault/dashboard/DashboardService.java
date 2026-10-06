package com.warrantyvault.dashboard;

import com.warrantyvault.product.Product;
import com.warrantyvault.product.ProductRepository;
import com.warrantyvault.product.CurrencyValueTotal;
import com.warrantyvault.product.DashboardCounts;
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
import org.springframework.data.domain.PageRequest;

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

        DashboardCounts totals = productRepository.findDashboardCounts(user.getId(), today, today.plusDays(thresholdDays));
        int active = totals == null || totals.active() == null ? 0 : totals.active().intValue();
        int expiringSoon = totals == null || totals.expiringSoon() == null ? 0 : totals.expiringSoon().intValue();
        int expired = totals == null || totals.expired() == null ? 0 : totals.expired().intValue();
        List<ProductSummary> upcoming = productRepository.findUpcomingForDashboard(
            user.getId(), today, PageRequest.of(0, UPCOMING_LIMIT)).stream()
            .map(product -> summary(product, today)).toList();
        List<ProductSummary> recentlyExpired = productRepository.findRecentlyExpiredForDashboard(
            user.getId(), today.minusDays(RECENT_EXPIRY_DAYS), today.minusDays(1),
            PageRequest.of(0, RECENTLY_EXPIRED_LIMIT)).stream()
            .map(product -> summary(product, today)).toList();

        Map<String, String> coveredValue = new LinkedHashMap<>();
        for (CurrencyValueTotal total : productRepository.findCoveredValueTotals(user.getId(), today)) {
            coveredValue.put(total.currency(), total.amount().setScale(2, RoundingMode.HALF_UP).toPlainString());
        }

        return new DashboardResponse(
            new Counts(active, expiringSoon, expired),
            thresholdDays,
            List.copyOf(upcoming),
            List.copyOf(recentlyExpired),
            coveredValue
        );
    }

    private ProductSummary summary(Product product, LocalDate today) {
        long daysRemaining = ChronoUnit.DAYS.between(today, product.getExpiresOn());
        String status = daysRemaining < 0 ? "EXPIRED"
            : daysRemaining <= appProperties.getExpiringSoonDays() ? "EXPIRING_SOON" : "ACTIVE";
        return new ProductSummary(product.getId(), product.getSpace().getId(), product.getSpace().getName(),
            product.getProductType(), product.getBrand(), product.getExpiresOn(), daysRemaining, status);
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
