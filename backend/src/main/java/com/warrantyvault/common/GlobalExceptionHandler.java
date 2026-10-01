package com.warrantyvault.common;

import jakarta.validation.ConstraintViolationException;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(ApiException.class)
    public ResponseEntity<Map<String, Object>> handleApiException(ApiException ex) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("type", "about:blank");
        body.put("title", ex.getCode());
        body.put("status", ex.getStatus());
        body.put("detail", ex.getMessage());
        body.put("code", ex.getCode());
        body.put("fieldErrors", Map.of());
        return ResponseEntity.status(ex.getStatus()).body(body);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        for (FieldError fieldError : ex.getBindingResult().getFieldErrors()) {
            fieldErrors.put(fieldError.getField(), fieldError.getDefaultMessage());
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("type", "about:blank");
        body.put("title", "VALIDATION_FAILED");
        body.put("status", HttpStatus.BAD_REQUEST.value());
        body.put("detail", "Validation failed");
        body.put("code", "VALIDATION_FAILED");
        body.put("fieldErrors", fieldErrors);
        return ResponseEntity.badRequest().body(body);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<Map<String, Object>> handleConstraint(ConstraintViolationException ex) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("type", "about:blank");
        body.put("title", "VALIDATION_FAILED");
        body.put("status", HttpStatus.BAD_REQUEST.value());
        body.put("detail", ex.getMessage());
        body.put("code", "VALIDATION_FAILED");
        body.put("fieldErrors", Map.of());
        return ResponseEntity.badRequest().body(body);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> handleAccessDenied(AccessDeniedException ex) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("type", "about:blank");
        body.put("title", "FORBIDDEN");
        body.put("status", HttpStatus.FORBIDDEN.value());
        body.put("detail", "Forbidden");
        body.put("code", "FORBIDDEN");
        body.put("fieldErrors", Map.of());
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(body);
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<Map<String, Object>> handleBadCredentials(BadCredentialsException ex) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("type", "about:blank");
        body.put("title", "INVALID_CREDENTIALS");
        body.put("status", HttpStatus.UNAUTHORIZED.value());
        body.put("detail", "Invalid email or password");
        body.put("code", "INVALID_CREDENTIALS");
        body.put("fieldErrors", Map.of());
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).header("Cache-Control", "no-store").body(body);
    }
}
