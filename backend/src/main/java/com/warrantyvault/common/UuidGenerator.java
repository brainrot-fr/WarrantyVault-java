package com.warrantyvault.common;

import java.util.UUID;

public final class UuidGenerator {
    private UuidGenerator() {}
    public static String nextId() { return UUID.randomUUID().toString(); }
}
