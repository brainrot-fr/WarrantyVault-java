package com.warrantyvault.reminder;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@Profile("local")
@ConditionalOnProperty(prefix = "app.reminders", name = "internal-scheduler-enabled", havingValue = "true")
public class ReminderScheduler {
    private final ReminderService reminderService;

    public ReminderScheduler(ReminderService reminderService) {
        this.reminderService = reminderService;
    }

    @Scheduled(cron = "0 0 8 * * *")
    public void runDaily() {
        reminderService.startAsync("SCHEDULER");
    }
}
