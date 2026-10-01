package com.warrantyvault.auth;

import com.warrantyvault.common.ApiException;
import com.warrantyvault.user.User;
import com.warrantyvault.user.UserRepository;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.util.Arrays;
import java.time.ZoneId;
import java.time.Clock;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {
    private final AuthenticationManager authenticationManager;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthService authService;
    private final Clock clock;

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request, HttpServletResponse response) {
        if (userRepository.existsByEmailIgnoreCase(request.email())) {
            throw new ApiException("EMAIL_TAKEN", "Email already taken", HttpStatus.CONFLICT.value());
        }
        String normalizedEmail = request.email().trim().toLowerCase();
        if (request.password().equalsIgnoreCase(normalizedEmail)) {
            throw new ApiException("VALIDATION_FAILED", "Password must not equal the email address", HttpStatus.BAD_REQUEST.value());
        }
        String timezone = request.timezone() == null || request.timezone().isBlank() ? "UTC" : request.timezone().trim();
        try {
            ZoneId.of(timezone);
        } catch (java.time.DateTimeException exception) {
            throw new ApiException("VALIDATION_FAILED", "Timezone must be a valid IANA timezone", HttpStatus.BAD_REQUEST.value());
        }
        User user = new User();
        user.setId(UUID.randomUUID().toString());
        user.setEmail(normalizedEmail);
        user.setName(request.name().trim());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setTimezone(timezone);
        user.setCreatedAt(java.time.Instant.now(clock));
        user.setUpdatedAt(java.time.Instant.now(clock));
        userRepository.save(user);
        return buildAuthResponse(user, response, HttpStatus.CREATED);
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody AuthRequest request, HttpServletResponse response) {
        Authentication auth = authenticationManager.authenticate(
            new UsernamePasswordAuthenticationToken(request.email().trim().toLowerCase(), request.password())
        );
        if (auth == null || !auth.isAuthenticated()) {
            throw new ApiException("INVALID_CREDENTIALS", "Invalid credentials", HttpStatus.UNAUTHORIZED.value());
        }
        User user = userRepository.findByEmailIgnoreCase(request.email()).orElseThrow(
            () -> new ApiException("INVALID_CREDENTIALS", "Invalid credentials", HttpStatus.UNAUTHORIZED.value())
        );
        user.setLastLoginAt(java.time.Instant.now(clock));
        userRepository.save(user);
        return buildAuthResponse(user, response, HttpStatus.OK);
    }

    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(HttpServletRequest request, HttpServletResponse response) {
        requireJsonRequest(request);
        String token = getCookieValue("wv_refresh");
        if (token == null || token.isBlank()) {
            throw new ApiException("INVALID_CREDENTIALS", "Refresh token required", HttpStatus.UNAUTHORIZED.value());
        }
        User user = authService.refreshSession(token, response);
        return ResponseEntity.ok()
            .header(HttpHeaders.CACHE_CONTROL, "no-store")
            .body(new AuthResponse(authService.issueAccessToken(user), 1800, UserDto.from(user)));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request, HttpServletResponse response) {
        requireJsonRequest(request);
        authService.logout(getCookieValue("wv_refresh"), response);
        return ResponseEntity.noContent().build();
    }

    private ResponseEntity<AuthResponse> buildAuthResponse(User user, HttpServletResponse response, HttpStatus status) {
        String accessToken = authService.issueAccessToken(user);
        authService.issueRefreshToken(user, response);
        return ResponseEntity.status(status)
            .header(HttpHeaders.CACHE_CONTROL, "no-store")
            .body(new AuthResponse(accessToken, 1800, UserDto.from(user)));
    }

    private void requireJsonRequest(HttpServletRequest request) {
        String contentType = request.getContentType();
        if (contentType == null || !contentType.toLowerCase().startsWith("application/json")
            || !"warrantyvault".equals(request.getHeader("X-Requested-With"))) {
            throw new ApiException("INVALID_REQUEST", "A trusted JSON request is required", HttpStatus.BAD_REQUEST.value());
        }
    }

    private String getCookieValue(String name) {
        HttpServletRequest request = ((ServletRequestAttributes) RequestContextHolder.currentRequestAttributes()).getRequest();
        if (request.getCookies() == null) {
            return null;
        }
        return Arrays.stream(request.getCookies())
            .filter(c -> c.getName().equals(name))
            .map(Cookie::getValue)
            .findFirst()
            .orElse(null);
    }
}
