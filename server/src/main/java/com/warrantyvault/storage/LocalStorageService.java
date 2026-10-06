package com.warrantyvault.storage;

import com.warrantyvault.common.ApiException;
import com.warrantyvault.config.AppProperties;
import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.nio.file.attribute.PosixFilePermission;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

@Service
@ConditionalOnProperty(name = "app.storage.provider", havingValue = "local", matchIfMissing = true)
@RequiredArgsConstructor
public class LocalStorageService implements StorageService {
    private static final Logger logger = LoggerFactory.getLogger(LocalStorageService.class);
    private static final Set<PosixFilePermission> DIRECTORY_PERMISSIONS = Set.of(
        PosixFilePermission.OWNER_READ, PosixFilePermission.OWNER_WRITE, PosixFilePermission.OWNER_EXECUTE);
    private static final Set<PosixFilePermission> FILE_PERMISSIONS = Set.of(
        PosixFilePermission.OWNER_READ, PosixFilePermission.OWNER_WRITE);

    private final AppProperties appProperties;
    private Path baseDirectory;

    @PostConstruct
    void initializeBaseDirectory() {
        baseDirectory = Paths.get(appProperties.getStorage().getLocalDir()).toAbsolutePath().normalize();
        logger.info("Local upload directory: {}", baseDirectory);
    }

    @Override
    public StoredFile store(byte[] bytes, String spaceId) {
        Path target = null;
        try {
            Path directory = baseDirectory.resolve(spaceId).normalize();
            if (!directory.startsWith(baseDirectory)) throw invalidPath();
            Files.createDirectories(directory);
            setPermissions(directory, DIRECTORY_PERMISSIONS);
            ImageSniffer.Format format = ImageSniffer.sniff(bytes)
                .orElseThrow(() -> new ApiException("UNSUPPORTED_MEDIA",
                    "Only JPEG, PNG, and WebP images are accepted", 415));
            String fileName = UUID.randomUUID() + "." + format.extension();
            target = directory.resolve(fileName);
            Files.write(target, bytes, StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE);
            setPermissions(target, FILE_PERMISSIONS);
            return new StoredFile(spaceId + "/" + fileName, format.contentType(), bytes.length);
        } catch (IOException exception) {
            if (target != null) {
                try {
                    Files.deleteIfExists(target);
                } catch (IOException cleanupFailure) {
                    logger.warn("Could not remove an incomplete upload file");
                }
            }
            throw new ApiException("STORAGE_FAILED", "The image could not be stored", 500);
        }
    }

    @Override
    public InputStream open(String key) {
        try {
            Path file = resolveKey(key);
            return Files.newInputStream(file);
        } catch (IOException exception) {
            throw new ApiException("FILE_NOT_FOUND", "Stored image could not be opened", 404);
        }
    }

    @Override
    public void delete(String key) {
        try {
            Files.deleteIfExists(resolveKey(key));
        } catch (IOException exception) {
            throw new ApiException("STORAGE_DELETE_FAILED", "Stored image could not be deleted", 500);
        }
    }

    private Path resolveKey(String key) {
        Path file = baseDirectory.resolve(key).normalize();
        if (!file.startsWith(baseDirectory)) throw invalidPath();
        return file;
    }

    private ApiException invalidPath() {
        return new ApiException("INVALID_PATH", "Invalid storage path", 400);
    }

    private void setPermissions(Path path, Set<PosixFilePermission> permissions) throws IOException {
        try {
            Files.setPosixFilePermissions(path, permissions);
        } catch (UnsupportedOperationException ignored) {
            // The filesystem does not expose POSIX permissions.
        }
    }
}
