package com.warrantyvault.reminder;

import com.warrantyvault.common.UuidGenerator;
import com.warrantyvault.config.AppProperties;
import com.warrantyvault.mail.MailService;
import com.warrantyvault.product.Product;
import com.warrantyvault.product.ProductRepository;
import com.warrantyvault.space.Space;
import com.warrantyvault.user.NotificationPreference;
import com.warrantyvault.user.NotificationPreferenceRepository;
import com.warrantyvault.user.User;
import com.warrantyvault.user.UserRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.Executor;
import java.util.concurrent.atomic.AtomicBoolean;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

@Service
public class ReminderService {
    private static final Logger logger = LoggerFactory.getLogger(ReminderService.class);
    private static final int USER_PAGE_SIZE = 100;
    private final UserRepository userRepository;
    private final NotificationPreferenceRepository preferenceRepository;
    private final ProductRepository productRepository;
    private final ReminderLogRepository reminderLogRepository;
    private final ReminderRunRepository reminderRunRepository;
    private final MailService mailService;
    private final AppProperties appProperties;
    private final Clock clock;
    private final Executor reminderExecutor;
    private final AtomicBoolean running = new AtomicBoolean();

    public ReminderService(UserRepository userRepository, NotificationPreferenceRepository preferenceRepository,
                           ProductRepository productRepository,
                           ReminderLogRepository reminderLogRepository, ReminderRunRepository reminderRunRepository,
                           MailService mailService, AppProperties appProperties, Clock clock,
                           @org.springframework.beans.factory.annotation.Qualifier("reminderExecutor") Executor reminderExecutor) {
        this.userRepository = userRepository;
        this.preferenceRepository = preferenceRepository;
        this.productRepository = productRepository;
        this.reminderLogRepository = reminderLogRepository;
        this.reminderRunRepository = reminderRunRepository;
        this.mailService = mailService;
        this.appProperties = appProperties;
        this.clock = clock;
        this.reminderExecutor = reminderExecutor;
    }

    public RunAccepted startAsync(String source) {
        if (!running.compareAndSet(false, true)) return new RunAccepted(null, true);
        ReminderRun run = newRun(source);
        try {
            reminderExecutor.execute(() -> {
                try {
                    execute(run.getId(), clock, null, false);
                } finally {
                    running.set(false);
                }
            });
            return new RunAccepted(run.getId(), false);
        } catch (RuntimeException exception) {
            finishFailed(run, exception);
            running.set(false);
            throw exception;
        }
    }

    public RunSummary run(Clock runClock, String source) {
        ReminderRun run = newRun(source);
        return execute(run.getId(), runClock, null, false);
    }

    public RunSummary run(Clock runClock, String source, LocalDate asOf) {
        ReminderRun run = newRun(source);
        return execute(run.getId(), runClock, asOf, false);
    }

    public RunSummary run(Clock runClock, String source, LocalDate asOf, boolean resetLogs) {
        ReminderRun run = newRun(source);
        return execute(run.getId(), runClock, asOf, resetLogs);
    }

    private ReminderRun newRun(String source) {
        ReminderRun run = new ReminderRun();
        run.setId(UuidGenerator.nextId());
        run.setStartedAt(Instant.now(clock));
        run.setTriggerSource(source);
        run.setStatus("RUNNING");
        run.setUsersNotified(0);
        run.setProductsReminded(0);
        return reminderRunRepository.save(run);
    }

    private RunSummary execute(String runId, Clock runClock, LocalDate forcedToday, boolean resetLogs) {
        ReminderRun run = reminderRunRepository.findById(runId).orElseThrow();
        int usersNotified = 0;
        int productsReminded = 0;
        int failedUsers = 0;
        try {
            if (resetLogs) reminderLogRepository.deleteAllInBatch();
            int pageNumber = 0;
            Page<User> page;
            do {
                page = userRepository.findAll(PageRequest.of(pageNumber++, USER_PAGE_SIZE, Sort.by("id").ascending()));
                for (User user : page.getContent()) {
                    try {
                        NotificationPreference preferences = preferenceRepository.findById(user.getId()).orElse(null);
                        if (preferences != null && !preferences.isRemindersEnabled()) continue;
                        int daysBefore = preferences == null ? 30 : preferences.getDaysBefore();
                        LocalDate today = forcedToday == null
                            ? LocalDate.now(runClock.withZone(ZoneId.of(user.getTimezone())))
                            : forcedToday;
                        List<DueProduct> dueProducts = dueProducts(user, today, daysBefore);
                        if (dueProducts.isEmpty()) continue;
                        sendDigest(user, today, dueProducts);
                        Instant sentAt = Instant.now(clock);
                        List<ReminderLog> logs = dueProducts.stream().map(item -> {
                            ReminderLog log = new ReminderLog();
                            log.setId(UuidGenerator.nextId());
                            log.setUser(user);
                            log.setProduct(item.product());
                            log.setExpiresOn(item.product().getExpiresOn());
                            log.setSentAt(sentAt);
                            return log;
                        }).toList();
                        reminderLogRepository.saveAll(logs);
                        usersNotified++;
                        productsReminded += dueProducts.size();
                    } catch (RuntimeException exception) {
                        failedUsers++;
                        logger.warn("Reminder digest failed for user {}: {}", user.getId(), exception.getClass().getSimpleName());
                    }
                }
            } while (page.hasNext());
            run.setUsersNotified(usersNotified);
            run.setProductsReminded(productsReminded);
            run.setFinishedAt(Instant.now(clock));
            run.setStatus(failedUsers == 0 ? "OK" : "FAILED");
            run.setError(failedUsers == 0 ? null : failedUsers + " user digest(s) failed; they will be retried");
            reminderRunRepository.save(run);
            return new RunSummary(runId, usersNotified, productsReminded, failedUsers, run.getStatus());
        } catch (RuntimeException exception) {
            finishFailed(run, exception);
            throw exception;
        }
    }

    private List<DueProduct> dueProducts(User user, LocalDate today, int daysBefore) {
        LocalDate lastCoveredDay = today.plusDays(daysBefore);
        List<DueProduct> due = new ArrayList<>(productRepository.findUnloggedReminderProducts(user.getId(), today, lastCoveredDay)
            .stream().map(product -> new DueProduct(product.getSpace(), product)).toList());
        due.sort(Comparator.comparing((DueProduct item) -> item.product().getExpiresOn())
            .thenComparing(item -> item.product().getProductType(), String.CASE_INSENSITIVE_ORDER));
        return due;
    }

    private void sendDigest(User user, LocalDate today, List<DueProduct> dueProducts) {
        int count = dueProducts.size();
        String subject = count == 1 ? "1 warranty ends soon" : count + " warranties end soon";
        String link = appProperties.getAppBaseUrl() + "/dashboard";
        StringBuilder plain = new StringBuilder("Here are the warranties ending soon:\n\n");
        StringBuilder rows = new StringBuilder();
        for (DueProduct item : dueProducts) {
            Product product = item.product();
            long days = ChronoUnit.DAYS.between(today, product.getExpiresOn());
            String label = product.getProductType() + " · " + product.getBrand() + " · " + item.space().getName();
            plain.append(label).append("; expires ").append(product.getExpiresOn()).append("; ")
                .append(days).append(days == 1 ? " day left\n" : " days left\n");
            rows.append("<li style=\"padding:12px 0;border-bottom:1px solid #dddddd\"><strong>")
                .append(escape(label)).append("</strong><br><span>Expires ")
                .append(product.getExpiresOn()).append(" · ")
                .append(days).append(days == 1 ? " day left" : " days left")
                .append("</span></li>");
        }
        plain.append("\nOpen your dashboard: ").append(link);
        String html = "<div style=\"font:16px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#263238;max-width:600px;margin:auto\">"
            + "<h1 style=\"font:400 28px/1.2 Georgia,serif\">" + escape(subject) + "</h1>"
            + "<p>" + subject + ".</p>"
            + "<ul style=\"list-style:none;padding:0;margin:20px 0\">" + rows + "</ul>"
            + "<p><a href=\"" + escape(link) + "\" style=\"display:inline-block;background:#516b58;color:#fff;padding:12px 18px;text-decoration:none;border-radius:8px\">Open WarrantyVault</a></p>"
            + "</div>";
        mailService.send(user.getEmail(), subject, plain.toString(), html);
    }

    private void finishFailed(ReminderRun run, RuntimeException exception) {
        run.setFinishedAt(Instant.now(clock));
        run.setStatus("FAILED");
        run.setError(exception.getClass().getSimpleName());
        reminderRunRepository.save(run);
        logger.error("Reminder run {} failed: {}", run.getId(), exception.getClass().getSimpleName());
    }

    private String escape(String value) {
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            .replace("\"", "&quot;").replace("'", "&#39;");
    }

    private record DueProduct(Space space, Product product) {}
    public record RunAccepted(String runId, boolean skipped) {}
    public record RunSummary(String runId, int usersNotified, int productsReminded, int failedUsers, String status) {}
}
