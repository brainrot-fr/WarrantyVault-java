package com.warrantyvault.storage;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import com.warrantyvault.common.ApiException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.time.Duration;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.storage.provider", havingValue = "cloudinary")
public class CloudinaryStorageService implements StorageService {
    private static final Logger logger = LoggerFactory.getLogger(CloudinaryStorageService.class);
    private static final Pattern KEY = Pattern.compile("warrantyvault/([^/]+)/([0-9a-f-]+)\\.(jpg|png|webp)");
    private static final Duration TIMEOUT = Duration.ofSeconds(10);

    @Value("${CLOUDINARY_URL:}")
    private String cloudinaryUrl;
    private Cloudinary cloudinary;

    @PostConstruct
    void initialize() {
        if (cloudinaryUrl == null || !cloudinaryUrl.matches("cloudinary://[^:@/]+:[^@/]+@[A-Za-z0-9_-]+")) {
            throw new IllegalStateException("CLOUDINARY_URL must be set as cloudinary://<api-key>:<api-secret>@<cloud-name> when Cloudinary storage is enabled.");
        }
        try {
            cloudinary = new Cloudinary(cloudinaryUrl);
            logger.info("Cloudinary storage provider enabled");
        } catch (RuntimeException exception) {
            throw new IllegalStateException("CLOUDINARY_URL is malformed; check the Cloudinary URL format.", exception);
        }
    }

    @Override
    public StoredFile store(byte[] bytes, String spaceId) {
        ImageSniffer.Format format = ImageSniffer.sniff(bytes)
            .orElseThrow(() -> new ApiException("UNSUPPORTED_MEDIA", "Only JPEG, PNG, and WebP images are accepted", 415));
        String publicId = "warrantyvault/" + spaceId + "/" + UUID.randomUUID();
        try {
            cloudinary.uploader().upload(bytes, ObjectUtils.asMap(
                "public_id", publicId,
                "resource_type", "image",
                "type", "authenticated",
                "format", format.extension(),
                "overwrite", false,
                "use_filename", false,
                "unique_filename", false,
                "transformation", null));
            return new StoredFile(publicId + "." + format.extension(), format.contentType(), bytes.length);
        } catch (Exception exception) {
            throw new ApiException("STORAGE_FAILED", "The image could not be stored", 502);
        }
    }

    @Override
    public InputStream open(String key) {
        Asset asset = parseKey(key);
        String signedUrl;
        try {
            signedUrl = cloudinary.url().secure(true).resourceType("image").type("authenticated")
                .signed(true).format(asset.extension()).generate(asset.publicId());
            HttpURLConnection connection = (HttpURLConnection) URI.create(signedUrl).toURL().openConnection();
            connection.setConnectTimeout((int) TIMEOUT.toMillis());
            connection.setReadTimeout((int) TIMEOUT.toMillis());
            int status = connection.getResponseCode();
            if (status == 404) throw new ApiException("FILE_NOT_FOUND", "Stored image could not be opened", 404);
            if (status < 200 || status >= 300) throw new ApiException("STORAGE_UPSTREAM_FAILED", "Image storage is unavailable", 502);
            return connection.getInputStream();
        } catch (ApiException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new ApiException("STORAGE_UPSTREAM_FAILED", "Image storage is unavailable", 502);
        }
    }

    @Override
    public void delete(String key) {
        Asset asset = parseKey(key);
        try {
            Map<?, ?> result = cloudinary.uploader().destroy(asset.publicId(),
                ObjectUtils.asMap("resource_type", "image", "type", "authenticated", "invalidate", true));
            Object response = result.get("result");
            if (response != null && !"ok".equals(response) && !"not found".equals(response)) {
                throw new ApiException("STORAGE_DELETE_FAILED", "Stored image could not be deleted", 502);
            }
        } catch (ApiException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new ApiException("STORAGE_DELETE_FAILED", "Stored image could not be deleted", 502);
        }
    }

    private Asset parseKey(String key) {
        Matcher matcher = KEY.matcher(key == null ? "" : key);
        if (!matcher.matches()) throw new ApiException("INVALID_PATH", "Invalid storage key", 400);
        return new Asset(matcher.group(1) + "/" + matcher.group(2), matcher.group(3).toLowerCase(Locale.ROOT));
    }

    private record Asset(String publicId, String extension) {}
}
