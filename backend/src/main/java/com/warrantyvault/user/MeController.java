package com.warrantyvault.user;

import com.warrantyvault.auth.UserDto;
import com.warrantyvault.common.ApiException;
import com.warrantyvault.security.CurrentUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.CookieValue;
import com.warrantyvault.auth.AuthService;
import com.warrantyvault.common.validation.MaxUtf8Bytes;
import org.springframework.transaction.annotation.Transactional;
import java.time.Clock;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class MeController {
    private final CurrentUser currentUser;
    private final UserRepository userRepository;
    private final AuthService authService;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;

    @GetMapping("/me")
    public UserDto me() {
        return UserDto.from(currentUser.get());
    }

    @PatchMapping("/me")
    public UserDto patchMe(@Valid @RequestBody UserUpdateRequest request) {
        User user = currentUser.get();
        if (request.name() != null && !request.name().isBlank()) user.setName(request.name());
        if (request.timezone() != null) {
            try {
                java.time.ZoneId.of(request.timezone());
            } catch (java.time.DateTimeException exception) {
                throw new ApiException("VALIDATION_FAILED", "Timezone must be a valid IANA timezone", HttpStatus.BAD_REQUEST.value());
            }
            user.setTimezone(request.timezone());
        }
        if (request.currency() != null) user.setCurrency(request.currency().toUpperCase(java.util.Locale.ROOT));
        user.setUpdatedAt(java.time.Instant.now(clock));
        userRepository.save(user);
        return UserDto.from(user);
    }

    @PostMapping("/me/password")
    @Transactional
    public ResponseEntity<Void> changePassword(@Valid @RequestBody PasswordChangeRequest request,
                                               @CookieValue(name = "wv_refresh", required = false) String currentRefreshToken) {
        User user = currentUser.get();
        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw new ApiException("INVALID_CURRENT_PASSWORD", "Current password is incorrect", HttpStatus.BAD_REQUEST.value());
        }
        if (request.newPassword().equalsIgnoreCase(user.getEmail())) {
            throw new ApiException("VALIDATION_FAILED", "Password must not equal the email address", HttpStatus.BAD_REQUEST.value());
        }
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        user.setUpdatedAt(java.time.Instant.now(clock));
        userRepository.save(user);
        if (currentRefreshToken == null || currentRefreshToken.isBlank()) {
            throw new ApiException("INVALID_CREDENTIALS", "Refresh session is required to change the password", HttpStatus.UNAUTHORIZED.value());
        }
        authService.revokeOtherRefreshFamilies(user.getId(), currentRefreshToken);
        return ResponseEntity.noContent().build();
    }

    public record UserUpdateRequest(
        @Size(min = 2, max = 120) String name,
        @Size(min = 1, max = 80) String timezone,
        @Pattern(regexp = "^[A-Za-z]{3}$") String currency
    ) {}
    public record PasswordChangeRequest(
        @NotBlank @Size(max = 72) @MaxUtf8Bytes(72) String currentPassword,
        @NotBlank @Size(min = 8, max = 72) @MaxUtf8Bytes(72) String newPassword
    ) {}
}
