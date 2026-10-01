package com.warrantyvault.auth;

import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

class PasswordByteLengthTest {
    @Test
    void rejectsPasswordThatFitsCharacterLimitButExceedsBcryptByteLimit() {
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
        RegisterRequest request = new RegisterRequest("Test Person", "person@example.test", "😀".repeat(18) + "ab", "UTC");

        assertTrue(validator.validate(request).stream().anyMatch(error -> error.getPropertyPath().toString().equals("password")));
    }
}
