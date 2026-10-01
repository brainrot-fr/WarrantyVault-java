package com.warrantyvault.reminder;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "reminder_runs")
@Getter
@Setter
@NoArgsConstructor
public class ReminderRun {
    @Id
    @Column(length = 36)
    private String id;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "finished_at")
    private Instant finishedAt;

    @Column(name = "trigger_source", nullable = false, length = 20)
    private String triggerSource;

    @Column(name = "users_notified", nullable = false)
    private int usersNotified;

    @Column(name = "products_reminded", nullable = false)
    private int productsReminded;

    @Column(nullable = false, length = 10)
    private String status;

    @Column(length = 500)
    private String error;
}
