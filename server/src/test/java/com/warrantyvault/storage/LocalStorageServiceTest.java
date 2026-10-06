package com.warrantyvault.storage;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.warrantyvault.common.ApiException;
import com.warrantyvault.config.AppProperties;
import java.nio.file.Path;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class LocalStorageServiceTest {
    @TempDir
    Path temporaryDirectory;

    private LocalStorageService storage;

    @BeforeEach
    void setUp() {
        AppProperties properties = new AppProperties();
        properties.getStorage().setLocalDir(temporaryDirectory.toString());
        storage = new LocalStorageService(properties);
        storage.initializeBaseDirectory();
    }

    @Test
    void rejectsTraversalAndReturnsJsonApiErrorForMissingFiles() {
        ApiException traversal = assertThrows(ApiException.class,
            () -> storage.store(new byte[] {(byte) 0xff, (byte) 0xd8, (byte) 0xff}, "../outside"));
        assertEquals("INVALID_PATH", traversal.getCode());

        ApiException missing = assertThrows(ApiException.class, () -> storage.open("space/missing.jpg"));
        assertEquals("FILE_NOT_FOUND", missing.getCode());
        storage.delete("space/missing.jpg");
    }
}
