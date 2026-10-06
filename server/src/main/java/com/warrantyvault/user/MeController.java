package com.warrantyvault.user;

import com.warrantyvault.auth.UserDto;
import com.warrantyvault.security.CurrentUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.CookieValue;
import com.warrantyvault.common.validation.MaxUtf8Bytes;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class MeController {
    private final CurrentUser currentUser;
    private final UserService userService;

    @GetMapping("/me")
    public UserDto me() {
        return UserDto.from(currentUser.get());
    }

    @PatchMapping("/me")
    public UserDto patchMe(@Valid @RequestBody UserUpdateRequest request) {
        return userService.updateProfile(request.name(), request.timezone(), request.currency());
    }

    @PostMapping("/me/password")
    public ResponseEntity<Void> changePassword(@Valid @RequestBody PasswordChangeRequest request,
                                               @CookieValue(name = "wv_refresh", required = false) String currentRefreshToken) {
        if (currentRefreshToken == null || currentRefreshToken.isBlank()) {
            throw new com.warrantyvault.common.ApiException("INVALID_CREDENTIALS",
                "Refresh session is required to change the password", HttpStatus.UNAUTHORIZED.value());
        }
        userService.changePassword(request.currentPassword(), request.newPassword(), currentRefreshToken);
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
