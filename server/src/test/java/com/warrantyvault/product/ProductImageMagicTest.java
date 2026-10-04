package com.warrantyvault.product;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.Test;

class ProductImageMagicTest {
    @Test
    void detectsSupportedImageFormatsFromMagicBytes() {
        assertEquals("image/jpeg", ProductService.imageContentType(new byte[] {(byte) 0xff, (byte) 0xd8, (byte) 0xff}));
        assertEquals("image/png", ProductService.imageContentType(new byte[] {
            (byte) 0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a
        }));
        byte[] webp = new byte[] {'R', 'I', 'F', 'F', 0, 0, 0, 0, 'W', 'E', 'B', 'P'};
        assertEquals("image/webp", ProductService.imageContentType(webp));
    }

    @Test
    void rejectsUnsupportedAndTruncatedImageHeaders() {
        assertNull(ProductService.imageContentType(new byte[] {'P', 'N', 'G'}));
        assertNull(ProductService.imageContentType(new byte[] {'R', 'I', 'F', 'F', 0, 0, 0, 0, 'J', 'P', 'E', 'G'}));
    }
}
