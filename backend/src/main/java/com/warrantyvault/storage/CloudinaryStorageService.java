package com.warrantyvault.storage;

import com.cloudinary.Cloudinary;
import com.warrantyvault.config.AppProperties;
import java.io.InputStream;
import java.net.URI;
import java.net.URL;
import java.util.HashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import com.warrantyvault.common.ApiException;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
@Profile("prod")
@RequiredArgsConstructor
public class CloudinaryStorageService implements StorageService {
    private final AppProperties appProperties;

    private Cloudinary cloudinary() {
        Map<String, String> cfg = new HashMap<>();
        cfg.put("cloud_name", appProperties.getCloudinary().getCloudName());
        cfg.put("api_key", appProperties.getCloudinary().getApiKey());
        cfg.put("api_secret", appProperties.getCloudinary().getApiSecret());
        return new Cloudinary(cfg);
    }

    @Override
    public StoredFile store(MultipartFile file, String spaceId) {
        try {
            String key = java.util.UUID.randomUUID().toString();
            Map<String, Object> params = new HashMap<>();
            params.put("folder", "warrantyvault/" + spaceId);
            params.put("public_id", key);
            params.put("resource_type", "image");
            params.put("type", "authenticated");
            Map upload = cloudinary().uploader().upload(file.getBytes(), params);
            return new StoredFile((String) upload.get("public_id"), file.getContentType(), file.getSize());
        } catch (Exception e) {
            throw new ApiException("STORAGE_FAILED", "The image could not be stored", 500);
        }
    }

    @Override
    public InputStream open(String key) {
        try {
            String signedUrl = cloudinary().url()
                .secure(true)
                .resourceType("image")
                .type("authenticated")
                .signed(true)
                .generate(key);
            URL url = URI.create(signedUrl).toURL();
            return url.openStream();
        } catch (Exception e) {
            throw new ApiException("STORAGE_READ_FAILED", "The stored image could not be opened", 502);
        }
    }

    @Override
    public void delete(String key) {
        try {
            cloudinary().uploader().destroy(key, Map.of("invalidate", true, "resource_type", "image", "type", "authenticated"));
        } catch (Exception e) {
            throw new ApiException("STORAGE_DELETE_FAILED", "The stored image could not be deleted", 502);
        }
    }
}
