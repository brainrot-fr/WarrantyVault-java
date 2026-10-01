package com.warrantyvault.dashboard;

import com.warrantyvault.member.SpaceMember;
import com.warrantyvault.member.SpaceMemberRepository;
import com.warrantyvault.product.Product;
import com.warrantyvault.product.ProductRepository;
import com.warrantyvault.user.NotificationPreferenceRepository;
import com.warrantyvault.user.User;
import java.math.BigDecimal;
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
import java.util.TreeMap;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DashboardService {
    private static final int DEFAULT_REMINDER_DAYS = 30;
    private static final int RECENT_EXPIRY_DAYS = 90;
    private static final int UPCOMING_LIMIT = 50;
    private static final int RECENTLY_EXPIRED_LIMIT = 20;

    private final SpaceMemberRepository memberRepository;
    private final ProductRepository productRepository;
    private final NotificationPreferenceRepository preferenceRepository;
    private final Clock clock;

    public DashboardService(SpaceMemberRepository memberRepository,
                           ProductRepository productRepository,
                           NotificationPreferenceRepository preferenceRepository,
                           Clock clock) {
        this.memberRepository = memberRepository;
        this.productRepository = productRepository;
        this.preferenceRepository = preferenceRepository;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public DashboardResponse getDashboard(User user) {
        ZoneId zone = ZoneId.of(user.getTimezone());
        LocalDate today = LocalDate.now(clock.withZone(zone));
        int thresholdDays = preferenceRepository.findById(user.getId())
            .map(preference -> preference.getDaysBefore())
            .orElse(DEFAULT_REMINDER_DAYS);

        List<Product> products = new ArrayList<>();
        for (SpaceMember membership : memberRepository.findByUser(user)) {
            products.addAll(productRepository.findBySpace(membership.getSpace()));
        }

        int active = 0;
        int expiringSoon = 0;
        int expired = 0;
        Map<String, BigDecimal> values = new TreeMap<>();
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
            values.merge(product.getCurrency(), product.getPurchasePrice(), BigDecimal::add);
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
        values.forEach((currency, amount) -> coveredValue.put(
            currency,
            amount.setScale(2, RoundingMode.HALF_UP).toPlainString()
        ));

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
