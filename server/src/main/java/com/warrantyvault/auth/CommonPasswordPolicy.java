package com.warrantyvault.auth;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

@Component
public class CommonPasswordPolicy {
    private final Set<String> commonPasswords;

    public CommonPasswordPolicy() {
        try (var stream = new ClassPathResource("common-passwords.txt").getInputStream();
             var reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            commonPasswords = reader.lines().map(value -> value.toLowerCase(Locale.ROOT)).collect(Collectors.toUnmodifiableSet());
        } catch (IOException exception) {
            throw new IllegalStateException("The common-password list could not be loaded", exception);
        }
    }

    public boolean isCommon(String password) {
        return password != null && commonPasswords.contains(password.toLowerCase(Locale.ROOT));
    }
}
