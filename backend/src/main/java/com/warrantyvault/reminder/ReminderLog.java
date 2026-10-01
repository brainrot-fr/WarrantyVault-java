package com.warrantyvault.reminder;

import com.warrantyvault.product.Product;
import com.warrantyvault.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import java.time.LocalDate;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "reminder_log", uniqueConstraints = @UniqueConstraint(
    name = "uq_reminder_log", columnNames = {"user_id", "product_id", "expires_on"}))
@Getter
@Setter
@NoArgsConstructor
public class ReminderLog {
    @Id
    @Column(length = 36)
    private String id;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(name = "expires_on", nullable = false)
    private LocalDate expiresOn;

    @Column(name = "sent_at", nullable = false)
    private Instant sentAt;
}
