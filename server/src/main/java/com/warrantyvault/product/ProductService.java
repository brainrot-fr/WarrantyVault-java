package com.warrantyvault.product;

import com.warrantyvault.common.ApiException;
import com.warrantyvault.common.UuidGenerator;
import com.warrantyvault.member.SpaceMember;
import com.warrantyvault.member.SpaceMemberRepository;
import com.warrantyvault.product.dto.ProductCreateRequest;
import com.warrantyvault.product.dto.ProductUpdateRequest;
import com.warrantyvault.security.CurrentUser;
import com.warrantyvault.space.Space;
import com.warrantyvault.space.SpaceRepository;
import com.warrantyvault.space.SpaceRole;
import com.warrantyvault.space.SpacePermissions;
import com.warrantyvault.storage.StorageService;
import com.warrantyvault.storage.ImageSniffer;
import com.warrantyvault.config.AppProperties;
import com.warrantyvault.user.User;
import com.warrantyvault.user.UserRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.io.IOException;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Comparator;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class ProductService {
    private static final Logger logger = LoggerFactory.getLogger(ProductService.class);
    private final ProductRepository productRepository;
    private final SpaceRepository spaceRepository;
    private final UserRepository userRepository;
    private final SpaceMemberRepository spaceMemberRepository;
    private final StorageService storageService;
    private final AppProperties appProperties;
    private final Clock clock;

    public ProductService(ProductRepository productRepository, SpaceRepository spaceRepository, UserRepository userRepository,
                          SpaceMemberRepository spaceMemberRepository, StorageService storageService,
                          AppProperties appProperties, Clock clock) {
        this.productRepository = productRepository;
        this.spaceRepository = spaceRepository;
        this.userRepository = userRepository;
        this.spaceMemberRepository = spaceMemberRepository;
        this.storageService = storageService;
        this.appProperties = appProperties;
        this.clock = clock;
    }

    @Transactional
    public Product createProduct(String spaceId, String userId, ProductCreateRequest request, MultipartFile bill, MultipartFile warrantyCard) {
        User user = userRepository.findById(userId).orElseThrow();
        SpaceMember membership = requireMembership(spaceId, userId);
        if (!SpacePermissions.canCreateProduct(membership.getRole())) {
            throw new ApiException("FORBIDDEN", "You cannot add products to this Space", 403);
        }
        ValidatedImage billImage = validateImage(bill, true);
        ValidatedImage cardImage = validateImage(warrantyCard, false);
        ensureStorageQuota(membership.getSpace().getId(), 0, billImage.bytes().length
            + (cardImage == null ? 0 : cardImage.bytes().length));
        StorageService.StoredFile stored = storageService.store(billImage.bytes(), membership.getSpace().getId());
        registerRollbackCleanup(List.of(stored.key()));
        StorageService.StoredFile storedCard = null;
        if (warrantyCard != null && !warrantyCard.isEmpty()) {
            storedCard = storageService.store(cardImage.bytes(), membership.getSpace().getId());
            registerRollbackCleanup(List.of(storedCard.key()));
        }
        Product product = new Product();
        product.setId(UuidGenerator.nextId());
        product.setSpace(membership.getSpace());
        product.setCreatedBy(user);
        product.setProductType(request.productType());
        product.setBrand(request.brand());
        product.setModelName(request.modelName());
        product.setSerialNumber(request.serialNumber());
        product.setPurchasedOn(parseDate(request.purchasedOn(), user));
        product.setWarrantyMonths(request.warrantyMonths());
        product.setPurchasePrice(new BigDecimal(request.purchasePrice()).setScale(2, RoundingMode.HALF_UP));
        product.setCurrency(currency(request.currency(), user.getCurrency()));
        product.setNotes(request.notes());
        LocalDate expiresOn = product.getPurchasedOn().plusMonths(product.getWarrantyMonths());
        product.setExpiresOn(expiresOn);
        product.setBillKey(stored.key());
        product.setBillContentType(billImage.contentType());
        product.setBillSizeBytes(stored.sizeBytes());
        product.setCardKey(storedCard == null ? null : storedCard.key());
        product.setCardContentType(cardImage == null ? null : cardImage.contentType());
        product.setCardSizeBytes(storedCard == null ? null : storedCard.sizeBytes());
        product.setCreatedAt(Instant.now(clock));
        product.setUpdatedAt(Instant.now(clock));
        return productRepository.save(product);
    }

    @Transactional
    public Product updateProduct(String productId, String userId, ProductUpdateRequest request,
                                 MultipartFile bill, MultipartFile warrantyCard) {
        Product product = productRepository.findByIdWithResponseDetails(productId)
            .orElseThrow(() -> new ApiException("NOT_FOUND", "Product not found", 404));
        SpaceMember membership = requireMembership(product.getSpace().getId(), userId);
        if (!SpacePermissions.canEditProduct(membership.getRole())) {
            throw new ApiException("FORBIDDEN", "You cannot edit products in this Space", 403);
        }
        if (request.version() != null && request.version() != product.getVersion()) {
            throw new ApiException("CONCURRENT_UPDATE", "This record changed while you were editing it. Reload and try again.", 409);
        }
        if (request.removeWarrantyCard() && warrantyCard != null && !warrantyCard.isEmpty()) {
            throw new ApiException("VALIDATION_FAILED", "A replacement card and card removal cannot be requested together", 400);
        }
        ValidatedImage replacementBill = bill != null && !bill.isEmpty() ? validateImage(bill, false) : null;
        ValidatedImage replacementCard = warrantyCard != null && !warrantyCard.isEmpty()
            ? validateImage(warrantyCard, false) : null;
        long replacingBytes = replacementBill == null ? 0 : product.getBillSizeBytes();
        long addedBytes = replacementBill == null ? 0 : replacementBill.bytes().length;
        if (replacementCard != null) {
            replacingBytes += product.getCardSizeBytes() == null ? 0 : product.getCardSizeBytes();
            addedBytes += replacementCard.bytes().length;
        } else if (request.removeWarrantyCard() && product.getCardSizeBytes() != null) {
            replacingBytes += product.getCardSizeBytes();
        }
        ensureStorageQuota(membership.getSpace().getId(), replacingBytes, addedBytes);
        List<String> replacedKeys = new ArrayList<>();
        if (replacementBill != null) {
            StorageService.StoredFile stored = storageService.store(replacementBill.bytes(), membership.getSpace().getId());
            registerRollbackCleanup(List.of(stored.key()));
            replacedKeys.add(product.getBillKey());
            product.setBillKey(stored.key());
            product.setBillContentType(replacementBill.contentType());
            product.setBillSizeBytes(stored.sizeBytes());
        }
        if (replacementCard != null) {
            StorageService.StoredFile stored = storageService.store(replacementCard.bytes(), membership.getSpace().getId());
            registerRollbackCleanup(List.of(stored.key()));
            if (product.getCardKey() != null) replacedKeys.add(product.getCardKey());
            product.setCardKey(stored.key());
            product.setCardContentType(replacementCard.contentType());
            product.setCardSizeBytes(stored.sizeBytes());
        } else if (request.removeWarrantyCard() && product.getCardKey() != null) {
            replacedKeys.add(product.getCardKey());
            product.setCardKey(null);
            product.setCardContentType(null);
            product.setCardSizeBytes(null);
        }
        ProductCreateRequest data = request.asCreateRequest();
        product.setProductType(data.productType());
        product.setBrand(data.brand());
        product.setModelName(data.modelName());
        product.setSerialNumber(data.serialNumber());
        product.setPurchasedOn(parseDate(data.purchasedOn(), membership.getUser()));
        product.setWarrantyMonths(data.warrantyMonths());
        product.setExpiresOn(product.getPurchasedOn().plusMonths(product.getWarrantyMonths()));
        product.setPurchasePrice(new BigDecimal(data.purchasePrice()).setScale(2, RoundingMode.HALF_UP));
        product.setCurrency(currency(data.currency(), product.getCurrency()));
        product.setNotes(data.notes());
        product.setUpdatedAt(Instant.now(clock));
        Product saved = productRepository.save(product);
        if (!replacedKeys.isEmpty()) registerAfterCommitCleanup(replacedKeys);
        return saved;
    }

    @Transactional(readOnly = true)
    public Product getProduct(String productId, String userId) {
        Product product = productRepository.findByIdWithResponseDetails(productId)
            .orElseThrow(() -> new ApiException("NOT_FOUND", "Product not found", 404));
        requireMembership(product.getSpace().getId(), userId);
        return product;
    }

    @Transactional(readOnly = true)
    public ProductResponse productResponse(Product product, String userId) {
        SpaceMember membership = requireMembership(product.getSpace().getId(), userId);
        User user = membership.getUser();
        LocalDate today = LocalDate.now(clock.withZone(ZoneId.of(user.getTimezone())));
        return ProductResponse.from(product, membership.getRole(), today, appProperties.getExpiringSoonDays());
    }

    @Transactional(readOnly = true)
    public ProductPage listProductResponses(String spaceId, String userId, String query, String status, String type,
                                            String sort, int page, int size) {
        if (page < 0 || size < 1 || size > 100) throw new ApiException("VALIDATION_FAILED", "Page must be nonnegative and size must be between 1 and 100", 400);
        if (query != null && query.length() > 120) {
            throw new ApiException("VALIDATION_FAILED", "Search text must be no longer than 120 characters", 400);
        }
        if (type != null && type.length() > 60) {
            throw new ApiException("VALIDATION_FAILED", "Product type must be no longer than 60 characters", 400);
        }
        if (status != null && !List.of("ACTIVE", "EXPIRING_SOON", "EXPIRED").contains(status)) {
            throw new ApiException("VALIDATION_FAILED", "Unsupported product status", 400);
        }
        if (sort != null && !List.of("expiry", "purchased", "name").contains(sort)) {
            throw new ApiException("VALIDATION_FAILED", "Unsupported product sort order", 400);
        }
        SpaceMember membership = requireMembership(spaceId, userId);
        User user = membership.getUser();
        LocalDate today = LocalDate.now(clock.withZone(ZoneId.of(user.getTimezone())));
        String sortOrder = sort == null ? "expiry" : sort;
        Pageable pageable = PageRequest.of(page, size);
        String trimmedQuery = query == null ? null : query.trim();
        String escapedQuery = trimmedQuery == null || trimmedQuery.isBlank() ? null
            : "%" + trimmedQuery.toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
        Page<Product> result = productRepository.findPageByFilters(spaceId, today,
            today.plusDays(appProperties.getExpiringSoonDays()), status,
            type == null || type.isBlank() ? null : type.toLowerCase(Locale.ROOT), escapedQuery, sortOrder, pageable);
        List<ProductResponse> items = result.getContent().stream()
            .map(product -> ProductResponse.from(product, membership.getRole(), today, appProperties.getExpiringSoonDays()))
            .toList();
        return new ProductPage(items, page, size, result.getTotalElements(), result.getTotalPages());
    }

    @Transactional
    public void deleteProduct(String productId, String userId) {
        Product product = productRepository.findById(productId).orElseThrow(() -> new ApiException("NOT_FOUND", "Product not found", 404));
        SpaceMember membership = requireMembership(product.getSpace().getId(), userId);
        if (!SpacePermissions.canDeleteProduct(membership.getRole())) {
            throw new ApiException("FORBIDDEN", "Cannot delete product", 403);
        }
        List<String> keys = new ArrayList<>();
        keys.add(product.getBillKey());
        if (product.getCardKey() != null) keys.add(product.getCardKey());
        productRepository.delete(product);
        registerAfterCommitCleanup(keys);
    }

    public ProductController.ProductFacets facets(String userId) {
        Set<String> types = new TreeSet<>(String.CASE_INSENSITIVE_ORDER);
        Set<String> brands = new TreeSet<>(String.CASE_INSENSITIVE_ORDER);
        productRepository.findDistinctFacetsForUser(userId).forEach(facet -> {
            types.add(facet.productType());
            brands.add(facet.brand());
        });
        return new ProductController.ProductFacets(List.copyOf(types), List.copyOf(brands));
    }

    public record ProductPage(List<ProductResponse> items, int page, int size, long totalItems, int totalPages) {}

    public SpaceMember requireMembership(String spaceId, String userId) {
        return spaceMemberRepository.findBySpaceIdAndUserId(spaceId, userId)
            .orElseThrow(() -> new ApiException("NOT_FOUND", "Space not found", 404));
    }

    private ValidatedImage validateImage(MultipartFile file, boolean required) {
        if (file == null || file.isEmpty()) {
            if (required) throw new ApiException("VALIDATION_FAILED", "A bill image is required", 400);
            return null;
        }
        if (file.getSize() > appProperties.getMaxUploadBytes()) {
            throw new ApiException("UPLOAD_TOO_LARGE", "Each image must be no larger than 10 MB", 413);
        }
        try {
            byte[] bytes = file.getBytes();
            String contentType = imageContentType(bytes);
            if (contentType == null) throw new ApiException("UNSUPPORTED_MEDIA", "Only JPEG, PNG, and WebP images are accepted", 415);
            return new ValidatedImage(bytes, contentType);
        } catch (IOException e) {
            throw new ApiException("UPLOAD_READ_FAILED", "The uploaded image could not be read", 400);
        }
    }

    static String imageContentType(byte[] bytes) {
        return ImageSniffer.sniff(bytes).map(ImageSniffer.Format::contentType).orElse(null);
    }

    private record ValidatedImage(byte[] bytes, String contentType) {}

    private void ensureStorageQuota(String spaceId, long replacedBytes, long addedBytes) {
        long quota = appProperties.getStorage().getMaxBytesPerSpace();
        if (quota == 0) return;
        long current = productRepository.sumStoredBytesBySpaceId(spaceId);
        if (current - replacedBytes + addedBytes > quota) {
            throw new ApiException("STORAGE_LIMIT", "This Space has reached its storage limit.", 413);
        }
    }

    private LocalDate parseDate(String value, User user) {
        try {
            LocalDate date = LocalDate.parse(value);
            if (date.isBefore(LocalDate.of(1970, 1, 1))) {
                throw new ApiException("VALIDATION_FAILED", "Purchase date cannot be before 1970.", 400);
            }
            if (date.isAfter(LocalDate.now(clock.withZone(ZoneId.of(user.getTimezone()))))) {
                throw new ApiException("VALIDATION_FAILED", "Purchase date cannot be in the future.", 400);
            }
            return date;
        } catch (java.time.DateTimeException e) {
            throw new ApiException("VALIDATION_FAILED", "Purchased on must be a valid calendar date", 400);
        }
    }

    private String currency(String value, String fallback) {
        String code = value == null ? fallback : value.toUpperCase(Locale.ROOT);
        try {
            return java.util.Currency.getInstance(code).getCurrencyCode();
        } catch (IllegalArgumentException exception) {
            throw new ApiException("VALIDATION_FAILED", "Unknown currency code.", 400);
        }
    }

    private void registerRollbackCleanup(List<String> keys) {
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status != STATUS_COMMITTED) {
                    for (String key : keys) {
                        try {
                            storageService.delete(key);
                        } catch (RuntimeException exception) {
                            logger.warn("Could not remove uncommitted upload {}", key);
                        }
                    }
                }
            }
        });
    }

    private void registerAfterCommitCleanup(List<String> keys) {
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                for (String key : keys) {
                    try {
                        storageService.delete(key);
                    } catch (RuntimeException exception) {
                        logger.warn("Could not remove replaced upload {}", key);
                    }
                }
            }
        });
    }
}
