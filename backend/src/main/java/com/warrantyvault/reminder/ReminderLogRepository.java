package com.warrantyvault.reminder;

import com.warrantyvault.product.Product;
import com.warrantyvault.user.User;
import java.time.LocalDate;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReminderLogRepository extends JpaRepository<ReminderLog, String> {
    boolean existsByUserAndProductAndExpiresOn(User user, Product product, LocalDate expiresOn);
}
