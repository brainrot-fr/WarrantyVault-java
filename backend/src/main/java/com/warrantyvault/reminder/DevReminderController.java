package com.warrantyvault.reminder;

import java.time.Clock;
import java.time.LocalDate;
import org.springframework.context.annotation.Profile;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dev/reminders")
@Profile("local")
public class DevReminderController {
    private final ReminderService reminderService;
    private final Clock clock;

    public DevReminderController(ReminderService reminderService, Clock clock) {
        this.reminderService = reminderService;
        this.clock = clock;
    }

    @PostMapping("/run")
    public ReminderService.RunSummary run(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate asOf,
                                          @RequestParam(defaultValue = "false") boolean reset) {
        return reminderService.run(clock, "DEV", asOf, reset);
    }
}
