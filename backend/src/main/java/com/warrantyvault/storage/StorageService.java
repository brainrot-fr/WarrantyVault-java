package com.warrantyvault.storage;

import java.io.InputStream;
import org.springframework.web.multipart.MultipartFile;

public interface StorageService {
    StoredFile store(MultipartFile file, String spaceId);
    InputStream open(String key);
    void delete(String key);

    record StoredFile(String key, String contentType, long sizeBytes) {}
}
