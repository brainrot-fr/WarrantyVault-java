package com.warrantyvault.auth;

public record AuthResponse(String accessToken, long expiresInSeconds, UserDto user) {}
