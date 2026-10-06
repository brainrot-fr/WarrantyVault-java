package com.warrantyvault.storage;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import com.warrantyvault.common.ApiException;
import java.io.IOException;
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
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

@Service
@ConditionalOnProperty(name = "app.storage.provider", havingValue = "cloudinary")
public class CloudinaryStorageService implements StorageService {
    private static final String BILL_FOLDER = "Home/bills";
    private static final Pattern KEY = Pattern.compile(
        "Home/bills/([A-Za-z0-9_-]+)/([0-9a-f-]+)\\.(jpg|png|webp)");
    private static final Pattern CLOUDINARY_URL = Pattern.compile(
        "cloudinary://[^:@/]+:[^@/]+@[A-Za-z0-9_-]+");
    private static final Duration TIMEOUT = Duration.ofSeconds(10);

    private final String cloudinaryUrl;
    private CloudinaryClient client;
    private UrlFetcher urlFetcher = new HttpUrlFetcher();

    @Autowired
    public CloudinaryStorageService(@Value("${CLOUDINARY_URL:}") String cloudinaryUrl) {
        this.cloudinaryUrl = cloudinaryUrl;
    }

    CloudinaryStorageService(CloudinaryClient client, UrlFetcher urlFetcher) {
        this.cloudinaryUrl = "test";
        this.client = client;
        this.urlFetcher = urlFetcher;
    }

    @PostConstruct
    void initialize() {
        if (!CLOUDINARY_URL.matcher(cloudinaryUrl == null ? "" : cloudinaryUrl).matches()) {
            throw new IllegalStateException(
                "CLOUDINARY_URL must be set as cloudinary://<api-key>:<api-secret>@<cloud-name> when Cloudinary storage is enabled.");
        }
        try {
            client = new SdkCloudinaryClient(new Cloudinary(cloudinaryUrl));
        } catch (RuntimeException exception) {
            throw new IllegalStateException(
                "CLOUDINARY_URL is malformed; check the Cloudinary URL format.");
        }
    }

    @Override
    public StoredFile store(byte[] bytes, String spaceId) {
        ImageSniffer.Format format = ImageSniffer.sniff(bytes)
            .orElseThrow(() -> new ApiException("UNSUPPORTED_MEDIA",
                "Only JPEG, PNG, and WebP images are accepted", 415));
        if (spaceId == null || !spaceId.matches("[A-Za-z0-9_-]+")) {
            throw new ApiException("INVALID_PATH", "Invalid storage path", 400);
        }
        String publicId = spaceId + "/" + UUID.randomUUID();
        String storageKey = BILL_FOLDER + "/" + publicId + "." + format.extension();
        try {
            client.upload(bytes, Map.of(
                "public_id", publicId,
                "asset_folder", BILL_FOLDER,
                "resource_type", "image",
                "type", "authenticated",
                "format", format.extension(),
                "overwrite", false,
                "use_filename", false,
                "unique_filename", false));
            return new StoredFile(storageKey, format.contentType(), bytes.length);
        } catch (Exception exception) {
            throw new ApiException("STORAGE_UPSTREAM_FAILED", "Image storage is unavailable", 502);
        }
    }

    @Override
    public InputStream open(String key) {
        Asset asset = parseKey(key);
        try {
            String signedUrl = client.signedUrl(asset.publicId(), asset.extension());
            FetchResult result = urlFetcher.fetch(signedUrl, TIMEOUT);
            if (result.status() == 404) {
                closeQuietly(result.body());
                throw new ApiException("FILE_NOT_FOUND", "Stored image could not be opened", 404);
            }
            if (result.status() < 200 || result.status() >= 300) {
                closeQuietly(result.body());
                throw new ApiException("STORAGE_UPSTREAM_FAILED", "Image storage is unavailable", 502);
            }
            return result.body();
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
            Object result = client.destroy(asset.publicId());
            if (result != null && !"ok".equals(result) && !"not found".equals(result)) {
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
        if (!matcher.matches()) {
            throw new ApiException("INVALID_PATH", "Invalid storage key", 400);
        }
        return new Asset(matcher.group(1) + "/" + matcher.group(2),
            matcher.group(3).toLowerCase(Locale.ROOT));
    }

    private void closeQuietly(InputStream stream) {
        if (stream != null) {
            try {
                stream.close();
            } catch (IOException ignored) {
                // The upstream response is already being discarded.
            }
        }
    }

    private record Asset(String publicId, String extension) {}
    record FetchResult(int status, InputStream body) {}

    interface UrlFetcher {
        FetchResult fetch(String url, Duration timeout) throws IOException;
    }

    interface CloudinaryClient {
        void upload(byte[] bytes, Map<String, Object> options) throws Exception;
        String signedUrl(String publicId, String extension);
        Object destroy(String publicId) throws Exception;
    }

    private static final class SdkCloudinaryClient implements CloudinaryClient {
        private final Cloudinary cloudinary;

        private SdkCloudinaryClient(Cloudinary cloudinary) {
            this.cloudinary = cloudinary;
        }

        @Override
        public void upload(byte[] bytes, Map<String, Object> options) throws Exception {
            cloudinary.uploader().upload(bytes, options);
        }

        @Override
        public String signedUrl(String publicId, String extension) {
            return cloudinary.url().secure(true).resourceType("image").type("authenticated")
                .signed(true)
                .format(extension).generate(publicId);
        }

        @Override
        public Object destroy(String publicId) throws Exception {
            Map<?, ?> result = cloudinary.uploader().destroy(publicId,
                ObjectUtils.asMap("resource_type", "image", "type", "authenticated", "invalidate", true));
            return result.get("result");
        }
    }

    private static final class HttpUrlFetcher implements UrlFetcher {
        @Override
        public FetchResult fetch(String url, Duration timeout) throws IOException {
            HttpURLConnection connection = (HttpURLConnection) URI.create(url).toURL().openConnection();
            connection.setConnectTimeout((int) timeout.toMillis());
            connection.setReadTimeout((int) timeout.toMillis());
            int status = connection.getResponseCode();
            return new FetchResult(status, status >= 400 ? connection.getErrorStream() : connection.getInputStream());
        }
    }
}
