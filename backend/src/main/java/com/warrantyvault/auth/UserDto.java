package com.warrantyvault.auth;

import com.warrantyvault.user.User;
import java.time.Instant;

public record UserDto(String id, String name, String email, String timezone, String currency, Instant createdAt) {
    public static UserDto from(User user) {
        return new UserDto(user.getId(), user.getName(), user.getEmail(), user.getTimezone(), user.getCurrency(), user.getCreatedAt());
    }
}
