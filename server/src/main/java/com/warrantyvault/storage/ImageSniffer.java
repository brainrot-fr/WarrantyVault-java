package com.warrantyvault.storage;

import java.util.Optional;

public final class ImageSniffer {
    private ImageSniffer() {}

    public static Optional<Format> sniff(byte[] bytes) {
        if (bytes == null) return Optional.empty();
        if (bytes.length >= 3 && (bytes[0] & 0xff) == 0xff && (bytes[1] & 0xff) == 0xd8
            && (bytes[2] & 0xff) == 0xff) return Optional.of(new Format("jpg", "image/jpeg"));
        if (bytes.length >= 8 && (bytes[0] & 0xff) == 0x89 && bytes[1] == 'P' && bytes[2] == 'N'
            && bytes[3] == 'G' && bytes[4] == 0x0d && bytes[5] == 0x0a && bytes[6] == 0x1a
            && bytes[7] == 0x0a) return Optional.of(new Format("png", "image/png"));
        if (bytes.length >= 12 && bytes[0] == 'R' && bytes[1] == 'I' && bytes[2] == 'F' && bytes[3] == 'F'
            && bytes[8] == 'W' && bytes[9] == 'E' && bytes[10] == 'B' && bytes[11] == 'P') {
            return Optional.of(new Format("webp", "image/webp"));
        }
        return Optional.empty();
    }

    public record Format(String extension, String contentType) {}
}
