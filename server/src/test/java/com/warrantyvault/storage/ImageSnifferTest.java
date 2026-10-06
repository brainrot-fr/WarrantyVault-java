package com.warrantyvault.storage;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class ImageSnifferTest {
    @Test
    void recognizesSupportedMagicBytesAndRejectsTextOrTruncatedInputs() {
        assertEquals("image/jpeg", ImageSniffer.sniff(bytes(0xff, 0xd8, 0xff)).orElseThrow().contentType());
        assertEquals("image/png", ImageSniffer.sniff(bytes(0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a))
            .orElseThrow().contentType());
        assertEquals("image/webp", ImageSniffer.sniff(bytes('R', 'I', 'F', 'F', 0, 0, 0, 0, 'W', 'E', 'B', 'P'))
            .orElseThrow().contentType());
        assertTrue(ImageSniffer.sniff(bytes(0xff, 0xd8)).isEmpty());
        assertTrue(ImageSniffer.sniff(bytes('R', 'I', 'F', 'F', 0, 0, 0, 0, 'J', 'P', 'E', 'G')).isEmpty());
        assertTrue(ImageSniffer.sniff(new byte[0]).isEmpty());
        assertTrue(ImageSniffer.sniff("<svg></svg>".getBytes(java.nio.charset.StandardCharsets.UTF_8)).isEmpty());
    }

    private byte[] bytes(int... values) {
        byte[] result = new byte[values.length];
        for (int index = 0; index < values.length; index++) result[index] = (byte) values[index];
        return result;
    }
}
