package com.warrantyvault.storage;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.warrantyvault.common.ApiException;
import java.io.ByteArrayInputStream;
import java.util.Map;
import org.junit.jupiter.api.Test;

class CloudinaryStorageServiceTest {
    @Test
    void storesAuthenticatedAssetWithStableKeyFormat() {
        FakeClient client = new FakeClient();
        CloudinaryStorageService storage = new CloudinaryStorageService(client,
            (url, timeout) -> new CloudinaryStorageService.FetchResult(200,
                new ByteArrayInputStream(new byte[] {1})));

        StorageService.StoredFile stored = storage.store(new byte[] {(byte) 0xff, (byte) 0xd8, (byte) 0xff},
            "space-123");

        assertEquals("image/jpeg", stored.contentType());
        assertEquals(3, stored.sizeBytes());
        assertEquals("Home/bills/space-123/" + client.publicId.substring(client.publicId.lastIndexOf('/') + 1) + ".jpg",
            stored.key());
        assertEquals("space-123/" + client.publicId.substring(client.publicId.lastIndexOf('/') + 1),
            client.publicId);
        assertEquals("authenticated", client.options.get("type"));
        assertEquals("Home/bills", client.options.get("asset_folder"));
        assertEquals(Boolean.FALSE, client.options.get("overwrite"));
    }

    @Test
    void mapsMissingAndUpstreamResponsesWithoutLeakingDetails() {
        FakeClient client = new FakeClient();
        CloudinaryStorageService storage = new CloudinaryStorageService(client,
            (url, timeout) -> new CloudinaryStorageService.FetchResult(404,
                new ByteArrayInputStream(new byte[0])));

        ApiException missing = assertThrows(ApiException.class,
            () -> storage.open("Home/bills/space/00000000-0000-0000-0000-000000000000.jpg"));
        assertEquals("FILE_NOT_FOUND", missing.getCode());

        CloudinaryStorageService unavailable = new CloudinaryStorageService(client,
            (url, timeout) -> new CloudinaryStorageService.FetchResult(503,
                new ByteArrayInputStream(new byte[0])));
        ApiException upstream = assertThrows(ApiException.class,
            () -> unavailable.open("Home/bills/space/00000000-0000-0000-0000-000000000000.jpg"));
        assertEquals("STORAGE_UPSTREAM_FAILED", upstream.getCode());
        assertEquals(502, upstream.getStatus());
    }

    @Test
    void opensCloudinaryKeysInBillsFolder() throws Exception {
        FakeClient client = new FakeClient();
        CloudinaryStorageService storage = new CloudinaryStorageService(client,
            (url, timeout) -> new CloudinaryStorageService.FetchResult(200,
                new ByteArrayInputStream(new byte[] {1})));

        storage.open("Home/bills/space/00000000-0000-0000-0000-000000000000.jpg").close();
    }

    @Test
    void rejectsMalformedKeysAndAcceptsMissingDeletes() {
        FakeClient client = new FakeClient();
        CloudinaryStorageService storage = new CloudinaryStorageService(client,
            (url, timeout) -> new CloudinaryStorageService.FetchResult(200,
                new ByteArrayInputStream(new byte[0])));

        ApiException invalid = assertThrows(ApiException.class,
            () -> storage.open("../outside.jpg"));
        assertEquals("INVALID_PATH", invalid.getCode());
        client.destroyResult = "not found";
        storage.delete("Home/bills/space/00000000-0000-0000-0000-000000000000.jpg");
    }

    @Test
    void validatesCloudinaryUrlWithoutIncludingTheSecret() {
        CloudinaryStorageService storage = new CloudinaryStorageService("");
        IllegalStateException failure = assertThrows(IllegalStateException.class, storage::initialize);
        assertEquals(true, failure.getMessage().contains("CLOUDINARY_URL"));
        assertEquals(false, failure.getMessage().contains("secret-value"));
    }

    private static final class FakeClient implements CloudinaryStorageService.CloudinaryClient {
        private String publicId;
        private Map<String, Object> options;
        private Object destroyResult = "ok";

        @Override
        public void upload(byte[] bytes, Map<String, Object> options) {
            this.options = options;
            this.publicId = (String) options.get("public_id");
        }

        @Override
        public String signedUrl(String publicId, String extension) {
            return "https://cloudinary.invalid/" + publicId + "." + extension;
        }

        @Override
        public Object destroy(String publicId) {
            return destroyResult;
        }
    }
}
