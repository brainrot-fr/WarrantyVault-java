package com.warrantyvault.common;

public class ApiException extends RuntimeException {
    private final String code;
    private final int status;
    private final java.util.Map<String, String> fieldErrors;

    public ApiException(String code, String message, int status) {
        this(code, message, status, java.util.Map.of());
    }

    public ApiException(String code, String message, int status, java.util.Map<String, String> fieldErrors) {
        super(message);
        this.code = code;
        this.status = status;
        this.fieldErrors = java.util.Map.copyOf(fieldErrors);
    }

    public String getCode() { return code; }
    public int getStatus() { return status; }
    public java.util.Map<String, String> getFieldErrors() { return fieldErrors; }
}
