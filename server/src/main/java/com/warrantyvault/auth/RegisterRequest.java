package com.warrantyvault.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import com.warrantyvault.common.validation.MaxUtf8Bytes;

public record RegisterRequest(
    @NotBlank @Size(min = 2, max = 120) String name,
    @NotBlank @Email String email,
    @NotBlank @Size(min = 8, max = 72) @MaxUtf8Bytes(72) String password,
    @Size(max = 64) String timezone
) {}
