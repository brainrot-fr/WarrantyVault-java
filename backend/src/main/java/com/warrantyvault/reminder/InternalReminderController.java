package com.warrantyvault.reminder;

import com.warrantyvault.config.AppProperties;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/internal/reminders")
public class InternalReminderController {
    private final ReminderService reminderService;
    private final AppProperties appProperties;

    public InternalReminderController(ReminderService reminderService, AppProperties appProperties) {
        this.reminderService = reminderService;
        this.appProperties = appProperties;
    }

    @PostMapping("/run")
    public ResponseEntity<?> run(@RequestHeader(value = "X-Cron-Secret", required = false) String suppliedSecret) {
        String expected = appProperties.getCronSecret();
        if (suppliedSecret == null || expected == null || expected.isBlank()
            || !MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), suppliedSecret.getBytes(StandardCharsets.UTF_8))) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.accepted().body(reminderService.startAsync("CRON"));
    }
}
