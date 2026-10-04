package com.warrantyvault.common;

import java.util.Map;

public record ProblemDetails(
    String type,
    String title,
    int status,
    String detail,
    String code,
    Map<String, String> fieldErrors
) {}
