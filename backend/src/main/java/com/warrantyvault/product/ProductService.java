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
import com.warrantyvault.config.AppProperties;
import com.warrantyvault.user.User;
import com.warrantyvault.user.UserRepository;
import java.math.BigDecimal;
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

@Service
public class ProductService {
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

    @Transactional(readOnly = true)
    public List<Product> listProducts(String spaceId, String userId) {
        SpaceMember membership = requireMembership(spaceId, userId);
        return productRepository.findBySpaceIdWithResponseDetails(membership.getSpace().getId());
    }

    @Transactional
    public Product createProduct(String spaceId, String userId, ProductCreateRequest request, MultipartFile bill, MultipartFile warrantyCard) {
        User user = userRepository.findById(userId).orElseThrow();
        SpaceMember membership = requireMembership(spaceId, userId);
        if (!SpacePermissions.canCreateProduct(membership.getRole())) {
            throw new ApiException("FORBIDDEN", "You cannot add products to this Space", 403);
        }
        String billContentType = validateImage(bill, true);
        StorageService.StoredFile stored = storageService.store(bill, membership.getSpace().getId());
        registerRollbackCleanup(List.of(stored.key()));
        String cardContentType = validateImage(warrantyCard, false);
        StorageService.StoredFile storedCard = null;
        if (warrantyCard != null && !warrantyCard.isEmpty()) {
            storedCard = storageService.store(warrantyCard, membership.getSpace().getId());
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
        product.setPurchasedOn(parseDate(request.purchasedOn()));
        product.setWarrantyMonths(request.warrantyMonths());
        product.setPurchasePrice(new BigDecimal(request.purchasePrice()));
        product.setCurrency(request.currency() == null ? "INR" : request.currency().toUpperCase(Locale.ROOT));
        product.setNotes(request.notes());
        LocalDate expiresOn = product.getPurchasedOn().plusMonths(product.getWarrantyMonths());
        product.setExpiresOn(expiresOn);
        product.setBillKey(stored.key());
        product.setBillContentType(billContentType);
        product.setBillSizeBytes(stored.sizeBytes());
        product.setCardKey(storedCard == null ? null : storedCard.key());
        product.setCardContentType(cardContentType);
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
        if (request.removeWarrantyCard() && warrantyCard != null && !warrantyCard.isEmpty()) {
            throw new ApiException("VALIDATION_FAILED", "A replacement card and card removal cannot be requested together", 400);
        }
        List<String> replacedKeys = new ArrayList<>();
        if (bill != null && !bill.isEmpty()) {
            String detectedType = validateImage(bill, false);
            StorageService.StoredFile stored = storageService.store(bill, membership.getSpace().getId());
            registerRollbackCleanup(List.of(stored.key()));
            replacedKeys.add(product.getBillKey());
            product.setBillKey(stored.key());
            product.setBillContentType(detectedType);
            product.setBillSizeBytes(stored.sizeBytes());
        }
        if (warrantyCard != null && !warrantyCard.isEmpty()) {
            String detectedType = validateImage(warrantyCard, false);
            StorageService.StoredFile stored = storageService.store(warrantyCard, membership.getSpace().getId());
            registerRollbackCleanup(List.of(stored.key()));
            if (product.getCardKey() != null) replacedKeys.add(product.getCardKey());
            product.setCardKey(stored.key());
            product.setCardContentType(detectedType);
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
        product.setPurchasedOn(parseDate(data.purchasedOn()));
        product.setWarrantyMonths(data.warrantyMonths());
        product.setExpiresOn(product.getPurchasedOn().plusMonths(product.getWarrantyMonths()));
        product.setPurchasePrice(new BigDecimal(data.purchasePrice()));
        product.setCurrency(data.currency() == null ? "INR" : data.currency().toUpperCase(Locale.ROOT));
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
        if (status != null && !List.of("ACTIVE", "EXPIRING_SOON", "EXPIRED").contains(status)) {
            throw new ApiException("VALIDATION_FAILED", "Unsupported product status", 400);
        }
        if (sort != null && !List.of("expiry", "purchased", "name").contains(sort)) {
            throw new ApiException("VALIDATION_FAILED", "Unsupported product sort order", 400);
        }
        SpaceMember membership = requireMembership(spaceId, userId);
        User user = membership.getUser();
        LocalDate today = LocalDate.now(clock.withZone(ZoneId.of(user.getTimezone())));
        List<ProductResponse> items = productRepository.findBySpaceIdWithResponseDetails(spaceId).stream()
            .map(product -> ProductResponse.from(product, membership.getRole(), today, appProperties.getExpiringSoonDays()))
            .filter(product -> status == null || status.equals(product.status()))
            .filter(product -> type == null || type.isBlank() || product.productType().equalsIgnoreCase(type))
            .filter(product -> query == null || query.isBlank() || (
                product.productType() + " " + product.brand() + " " + nullToEmpty(product.modelName()) + " "
                    + nullToEmpty(product.serialNumber()) + " " + nullToEmpty(product.notes())
            ).toLowerCase(Locale.ROOT).contains(query.toLowerCase(Locale.ROOT)))
            .sorted(productComparator(sort))
            .toList();
        long total = items.size();
        int start = Math.min(items.size(), page * size);
        int end = Math.min(items.size(), start + size);
        int totalPages = (int) Math.ceil(total / (double) size);
        return new ProductPage(items.subList(start, end), page, size, total, totalPages);
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

    private Comparator<ProductResponse> productComparator(String sort) {
        if ("purchased".equals(sort)) return Comparator.comparing(ProductResponse::purchasedOn).reversed();
        if ("name".equals(sort)) return Comparator.comparing(ProductResponse::productType, String.CASE_INSENSITIVE_ORDER)
            .thenComparing(ProductResponse::brand, String.CASE_INSENSITIVE_ORDER);
        return Comparator.comparing((ProductResponse item) -> "EXPIRED".equals(item.status()))
            .thenComparing(ProductResponse::expiresOn);
    }

    private String nullToEmpty(String value) { return value == null ? "" : value; }

    public record ProductPage(List<ProductResponse> items, int page, int size, long totalItems, int totalPages) {}

    public SpaceMember requireMembership(String spaceId, String userId) {
        Space space = spaceRepository.findById(spaceId).orElseThrow(() -> new ApiException("NOT_FOUND", "Space not found", 404));
        User user = userRepository.findById(userId).orElseThrow(() -> new ApiException("NOT_FOUND", "User not found", 404));
        return spaceMemberRepository.findBySpaceAndUser(space, user)
            .orElseThrow(() -> new ApiException("NOT_FOUND", "Space not found", 404));
    }

    private String validateImage(MultipartFile file, boolean required) {
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
            return contentType;
        } catch (IOException e) {
            throw new ApiException("UPLOAD_READ_FAILED", "The uploaded image could not be read", 400);
        }
    }

    static String imageContentType(byte[] bytes) {
        if (bytes.length >= 3 && (bytes[0] & 0xff) == 0xff && (bytes[1] & 0xff) == 0xd8 && (bytes[2] & 0xff) == 0xff) return "image/jpeg";
        if (bytes.length >= 8 && (bytes[0] & 0xff) == 0x89 && bytes[1] == 'P' && bytes[2] == 'N' && bytes[3] == 'G'
            && bytes[4] == 0x0d && bytes[5] == 0x0a && bytes[6] == 0x1a && bytes[7] == 0x0a) return "image/png";
        if (bytes.length >= 12 && bytes[0] == 'R' && bytes[1] == 'I' && bytes[2] == 'F' && bytes[3] == 'F'
            && bytes[8] == 'W' && bytes[9] == 'E' && bytes[10] == 'B' && bytes[11] == 'P') return "image/webp";
        return null;
    }

    private LocalDate parseDate(String value) {
        try {
            return LocalDate.parse(value);
        } catch (java.time.DateTimeException e) {
            throw new ApiException("VALIDATION_FAILED", "Purchased on must be a valid calendar date", 400);
        }
    }

    private void registerRollbackCleanup(List<String> keys) {
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status != STATUS_COMMITTED) keys.forEach(storageService::delete);
            }
        });
    }

    private void registerAfterCommitCleanup(List<String> keys) {
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                keys.forEach(storageService::delete);
            }
        });
    }
}
