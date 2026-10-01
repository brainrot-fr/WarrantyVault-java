package com.warrantyvault.reminder;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.warrantyvault.config.AppProperties;
import com.warrantyvault.mail.MailService;
import com.warrantyvault.product.Product;
import com.warrantyvault.product.ProductRepository;
import com.warrantyvault.space.Space;
import com.warrantyvault.space.SpaceRepository;
import com.warrantyvault.user.NotificationPreference;
import com.warrantyvault.user.NotificationPreferenceRepository;
import com.warrantyvault.user.User;
import com.warrantyvault.user.UserRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.Executor;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

class ReminderServiceTest {
    @Test
    void includesProductAtUserTimezoneWindowAndUsesNewExpiryToRearmReminder() {
        ReminderFixture fixture = new ReminderFixture("Asia/Kolkata", "2025-01-03", 1);
        Clock clock = Clock.fixed(Instant.parse("2025-01-01T20:00:00Z"), ZoneOffset.UTC);
        fixture.mockDue(false);

        ReminderService.RunSummary result = fixture.service.run(clock, "TEST");

        assertEquals(1, result.usersNotified());
        assertEquals(1, result.productsReminded());
        verify(fixture.productRepository).findUnloggedReminderProducts(
            fixture.user.getId(), LocalDate.parse("2025-01-02"), LocalDate.parse("2025-01-03"));
    }

    @Test
    void skipsProductsAlreadyLoggedForTheCurrentExpiry() {
        ReminderFixture fixture = new ReminderFixture("UTC", "2025-01-31", 30);
        fixture.mockDue(true);

        ReminderService.RunSummary result = fixture.service.run(
            Clock.fixed(Instant.parse("2025-01-01T12:00:00Z"), ZoneOffset.UTC), "TEST");

        assertEquals(0, result.usersNotified());
        assertEquals(0, result.productsReminded());
    }

    @Test
    void resetRunClearsReminderHistoryBeforeSendingAgain() {
        ReminderFixture fixture = new ReminderFixture("UTC", "2025-01-31", 30);
        fixture.mockDue(false);

        ReminderService.RunSummary result = fixture.service.run(
            Clock.fixed(Instant.parse("2025-01-01T12:00:00Z"), ZoneOffset.UTC), "DEV", null, true);

        assertEquals(1, result.productsReminded());
        verify(fixture.reminderLogRepository).deleteAllInBatch();
    }

    private static final class ReminderFixture {
        private final UserRepository userRepository = mock(UserRepository.class);
        private final NotificationPreferenceRepository preferenceRepository = mock(NotificationPreferenceRepository.class);
        private final SpaceRepository spaceRepository = mock(SpaceRepository.class);
        private final ProductRepository productRepository = mock(ProductRepository.class);
        private final ReminderLogRepository reminderLogRepository = mock(ReminderLogRepository.class);
        private final ReminderRunRepository reminderRunRepository = mock(ReminderRunRepository.class);
        private final MailService mailService = mock(MailService.class);
        private final User user = new User();
        private final Space space = new Space();
        private final Product product = new Product();
        private final ReminderService service;
        private final AtomicReference<ReminderRun> storedRun = new AtomicReference<>();

        private ReminderFixture(String timezone, String expiresOn, int threshold) {
            user.setId("user-id");
            user.setEmail("person@example.test");
            user.setName("Person");
            user.setTimezone(timezone);
            NotificationPreference preference = new NotificationPreference();
            preference.setUser(user);
            preference.setRemindersEnabled(true);
            preference.setDaysBefore(threshold);
            when(preferenceRepository.findById(user.getId())).thenReturn(Optional.of(preference));
            when(userRepository.findAll(any(Pageable.class))).thenReturn(new PageImpl<>(List.of(user)));

            space.setId("space-id");
            space.setName("Home");
            product.setId("product-id");
            product.setSpace(space);
            product.setProductType("Refrigerator");
            product.setBrand("LG");
            product.setPurchasedOn(LocalDate.parse("2024-01-01"));
            product.setExpiresOn(LocalDate.parse(expiresOn));
            when(reminderRunRepository.save(any(ReminderRun.class))).thenAnswer(call -> {
                ReminderRun run = call.getArgument(0);
                storedRun.set(run);
                return run;
            });
            when(reminderRunRepository.findById(any())).thenAnswer(call -> Optional.ofNullable(storedRun.get()));
            AppProperties properties = new AppProperties();
            properties.setAppBaseUrl("https://warrantyvault.example");
            Executor executor = Runnable::run;
            service = new ReminderService(userRepository, preferenceRepository, productRepository,
                reminderLogRepository, reminderRunRepository, mailService, properties, Clock.systemUTC(), executor);
        }

        private void mockDue(boolean logged) {
            when(productRepository.findUnloggedReminderProducts(any(), any(), any()))
                .thenReturn(logged ? List.of() : List.of(product));
            when(userRepository.findAll(any(Pageable.class))).thenReturn(new PageImpl<>(List.of(user), PageRequest.of(0, 100), 1));
        }
    }
}
