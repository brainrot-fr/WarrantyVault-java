package com.warrantyvault.storage;

import java.io.InputStream;
import java.io.IOException;
import com.warrantyvault.common.ApiException;
import org.springframework.web.multipart.MultipartFile;

public interface StorageService {
    StoredFile store(byte[] bytes, String spaceId);
    default StoredFile store(MultipartFile file, String spaceId) {
        try {
            return store(file.getBytes(), spaceId);
        } catch (IOException exception) {
            throw new ApiException("UPLOAD_READ_FAILED", "The uploaded image could not be read", 400);
        }
    }
    InputStream open(String key);
    void delete(String key);

    record StoredFile(String key, String contentType, long sizeBytes) {}
}
