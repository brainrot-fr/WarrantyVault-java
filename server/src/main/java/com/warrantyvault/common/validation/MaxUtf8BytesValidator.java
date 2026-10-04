package com.warrantyvault.common.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import java.nio.charset.StandardCharsets;

public class MaxUtf8BytesValidator implements ConstraintValidator<MaxUtf8Bytes, CharSequence> {
    private int maximum;

    @Override
    public void initialize(MaxUtf8Bytes constraint) {
        maximum = constraint.value();
    }

    @Override
    public boolean isValid(CharSequence value, ConstraintValidatorContext context) {
        return value == null || value.toString().getBytes(StandardCharsets.UTF_8).length <= maximum;
    }
}
