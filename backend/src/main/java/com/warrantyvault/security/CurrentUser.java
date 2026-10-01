package com.warrantyvault.security;

import com.warrantyvault.common.ApiException;
import com.warrantyvault.user.User;
import com.warrantyvault.user.UserRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component
public class CurrentUser {
    private final UserRepository userRepository;

    public CurrentUser(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public User get() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) {
            throw new ApiException("INVALID_CREDENTIALS", "Authentication is required", 401);
        }
        return userRepository.findByEmailIgnoreCase(auth.getName())
            .orElseThrow(() -> new ApiException("INVALID_CREDENTIALS", "Authentication is required", 401));
    }
}
