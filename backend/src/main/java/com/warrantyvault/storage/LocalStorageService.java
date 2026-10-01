package com.warrantyvault.storage;

import com.warrantyvault.config.AppProperties;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import com.warrantyvault.common.ApiException;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
@Profile("local")
@RequiredArgsConstructor
public class LocalStorageService implements StorageService {
    private final AppProperties appProperties;

    @Override
    public StoredFile store(MultipartFile file, String spaceId) {
        try {
            Path base = Paths.get(appProperties.getStorage().getLocalDir()).toAbsolutePath().normalize();
            Path dir = base.resolve(spaceId).normalize();
            if (!dir.startsWith(base)) throw new ApiException("INVALID_PATH", "Invalid storage path", 400);
            Files.createDirectories(dir);
            byte[] bytes = file.getBytes();
            ImageFormat format = imageFormat(bytes);
            if (format == null) throw new ApiException("UNSUPPORTED_MEDIA", "Only JPEG, PNG, and WebP images are accepted", 415);
            String fileName = UUID.randomUUID() + "." + format.extension();
            Path target = dir.resolve(fileName);
            Files.write(target, bytes);
            return new StoredFile(spaceId + "/" + fileName, format.contentType(), bytes.length);
        } catch (IOException e) {
            throw new ApiException("STORAGE_FAILED", "The image could not be stored", 500);
        }
    }

    @Override
    public InputStream open(String key) {
        try {
            Path base = Paths.get(appProperties.getStorage().getLocalDir()).toAbsolutePath().normalize();
            Path file = base.resolve(key).normalize();
            if (!file.startsWith(base)) throw new ApiException("INVALID_PATH", "Invalid storage path", 400);
            return Files.newInputStream(file);
        } catch (IOException e) {
            throw new ApiException("FILE_NOT_FOUND", "Stored image could not be opened", 404);
        }
    }

    @Override
    public void delete(String key) {
        try {
            Path base = Paths.get(appProperties.getStorage().getLocalDir()).toAbsolutePath().normalize();
            Path file = base.resolve(key).normalize();
            if (!file.startsWith(base)) throw new ApiException("INVALID_PATH", "Invalid storage path", 400);
            Files.deleteIfExists(file);
        } catch (IOException e) {
            throw new ApiException("STORAGE_DELETE_FAILED", "Stored image could not be deleted", 500);
        }
    }

    private ImageFormat imageFormat(byte[] bytes) {
        if (bytes.length >= 3 && (bytes[0] & 0xff) == 0xff && (bytes[1] & 0xff) == 0xd8 && (bytes[2] & 0xff) == 0xff) return new ImageFormat("jpg", "image/jpeg");
        if (bytes.length >= 8 && (bytes[0] & 0xff) == 0x89 && bytes[1] == 'P' && bytes[2] == 'N' && bytes[3] == 'G'
            && bytes[4] == 0x0d && bytes[5] == 0x0a && bytes[6] == 0x1a && bytes[7] == 0x0a) return new ImageFormat("png", "image/png");
        if (bytes.length >= 12 && bytes[0] == 'R' && bytes[1] == 'I' && bytes[2] == 'F' && bytes[3] == 'F'
            && bytes[8] == 'W' && bytes[9] == 'E' && bytes[10] == 'B' && bytes[11] == 'P') return new ImageFormat("webp", "image/webp");
        return null;
    }

    private record ImageFormat(String extension, String contentType) {}
}
