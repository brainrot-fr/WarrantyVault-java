package com.warrantyvault.user;

import com.warrantyvault.auth.AuthService;
import com.warrantyvault.auth.CommonPasswordPolicy;
import com.warrantyvault.auth.UserDto;
import com.warrantyvault.common.ApiException;
import com.warrantyvault.security.CurrentUser;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Currency;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserService {
    private final CurrentUser currentUser;
    private final UserRepository userRepository;
    private final AuthService authService;
    private final PasswordEncoder passwordEncoder;
    private final CommonPasswordPolicy commonPasswordPolicy;
    private final Clock clock;

    @Transactional
    public UserDto updateProfile(String requestedName, String timezone, String currency) {
        User user = currentUser.get();
        if (requestedName != null) {
            String name = requestedName.trim();
            if (name.length() < 2 || name.length() > 120) {
                throw new ApiException("VALIDATION_FAILED", "Name must be between 2 and 120 characters.",
                    HttpStatus.BAD_REQUEST.value(), java.util.Map.of("name", "Name must be between 2 and 120 characters."));
            }
            user.setName(name);
        }
        if (timezone != null) {
            try {
                ZoneId.of(timezone);
            } catch (java.time.DateTimeException exception) {
                throw new ApiException("VALIDATION_FAILED", "Timezone must be a valid IANA timezone", 400);
            }
            user.setTimezone(timezone);
        }
        if (currency != null) {
            try {
                user.setCurrency(Currency.getInstance(currency.toUpperCase(Locale.ROOT)).getCurrencyCode());
            } catch (IllegalArgumentException exception) {
                throw new ApiException("VALIDATION_FAILED", "Unknown currency code.", 400);
            }
        }
        user.setUpdatedAt(Instant.now(clock));
        return UserDto.from(userRepository.save(user));
    }

    @Transactional
    public void changePassword(String currentPassword, String newPassword, String currentRefreshToken) {
        User user = currentUser.get();
        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new ApiException("INVALID_CURRENT_PASSWORD", "Current password is incorrect", HttpStatus.BAD_REQUEST.value());
        }
        if (newPassword.equals(currentPassword)) {
            throw new ApiException("VALIDATION_FAILED", "Choose a different password.", 400);
        }
        if (commonPasswordPolicy.isCommon(newPassword)) {
            throw new ApiException("VALIDATION_FAILED", "Choose a less common password.", 400);
        }
        if (newPassword.equalsIgnoreCase(user.getEmail())) {
            throw new ApiException("VALIDATION_FAILED", "Password must not equal the email address", 400);
        }
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setUpdatedAt(Instant.now(clock));
        userRepository.save(user);
        authService.revokeOtherRefreshFamilies(user.getId(), currentRefreshToken);
    }
}
