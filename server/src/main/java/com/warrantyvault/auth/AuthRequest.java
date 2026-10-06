package com.warrantyvault.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import com.warrantyvault.common.validation.MaxUtf8Bytes;

public record AuthRequest(
    @NotBlank @Email String email,
    @NotBlank @Size(min = 8, max = 72) @MaxUtf8Bytes(72) String password
) {}
