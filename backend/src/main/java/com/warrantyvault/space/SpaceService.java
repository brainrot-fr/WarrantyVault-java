package com.warrantyvault.space;

import com.warrantyvault.common.ApiException;
import com.warrantyvault.common.UuidGenerator;
import com.warrantyvault.member.SpaceMember;
import com.warrantyvault.member.SpaceMemberRepository;
import com.warrantyvault.product.Product;
import com.warrantyvault.product.ProductRepository;
import com.warrantyvault.storage.StorageService;
import com.warrantyvault.user.User;
import com.warrantyvault.user.NotificationPreferenceRepository;
import com.warrantyvault.user.UserRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
public class SpaceService {
    private final SpaceRepository spaceRepository;
    private final UserRepository userRepository;
    private final SpaceMemberRepository spaceMemberRepository;
    private final ProductRepository productRepository;
    private final StorageService storageService;
    private final NotificationPreferenceRepository preferenceRepository;
    private final Clock clock;

    public SpaceService(SpaceRepository spaceRepository, UserRepository userRepository, SpaceMemberRepository spaceMemberRepository,
                        ProductRepository productRepository, StorageService storageService,
                        NotificationPreferenceRepository preferenceRepository, Clock clock) {
        this.spaceRepository = spaceRepository;
        this.userRepository = userRepository;
        this.spaceMemberRepository = spaceMemberRepository;
        this.productRepository = productRepository;
        this.storageService = storageService;
        this.preferenceRepository = preferenceRepository;
        this.clock = clock;
    }

    @Transactional
    public Space createSpace(String ownerId, String name, String description) {
        User owner = userRepository.findById(ownerId).orElseThrow(() -> new ApiException("NOT_FOUND", "User not found", 404));
        if (spaceRepository.existsByOwnerAndName(owner, name.trim())) {
            throw new ApiException("SPACE_EXISTS", "Space already exists", 409);
        }
        Space space = new Space();
        space.setId(UuidGenerator.nextId());
        space.setOwner(owner);
        space.setName(name.trim());
        space.setDescription(description);
        space.setCreatedAt(Instant.now(clock));
        space.setUpdatedAt(Instant.now(clock));
        Space saved = spaceRepository.save(space);

        SpaceMember member = new SpaceMember();
        member.setSpace(saved);
        member.setUser(owner);
        member.setRole(SpaceRole.OWNER);
        member.setAddedAt(Instant.now(clock));
        spaceMemberRepository.save(member);
        return saved;
    }

    public List<Space> listSpacesForUser(String userId) {
        return spaceRepository.findByUserId(userId);
    }

    public List<SpaceResponse> listSpaceResponses(String userId) {
        return listSpacesForUser(userId).stream().map(space -> toResponse(space, userId)).toList();
    }

    public SpaceResponse spaceResponse(String spaceId, String userId) {
        return toResponse(requireMembership(spaceId, userId).getSpace(), userId);
    }

    public SpaceResponse createdSpaceResponse(Space space, String userId) {
        return toResponse(space, userId);
    }

    @Transactional
    public Space updateSpace(String spaceId, String userId, String name, String description) {
        SpaceMember membership = requireMembership(spaceId, userId);
        if (!SpacePermissions.canDeleteSpace(membership.getRole())) {
            throw new ApiException("FORBIDDEN", "Only the owner can edit this Space", 403);
        }
        Space space = membership.getSpace();
        String nextName = name == null ? space.getName() : name.trim();
        if (nextName.isBlank() || nextName.length() > 80) throw new ApiException("VALIDATION_FAILED", "Space name must be between 1 and 80 characters", 400);
        if (!nextName.equals(space.getName()) && spaceRepository.existsByOwnerAndName(space.getOwner(), nextName)) {
            throw new ApiException("SPACE_EXISTS", "A Space with this name already exists", 409);
        }
        space.setName(nextName);
        if (description != null) space.setDescription(description);
        space.setUpdatedAt(Instant.now(clock));
        return spaceRepository.save(space);
    }

    public Space getSpace(String spaceId, String userId) {
        return requireMembership(spaceId, userId).getSpace();
    }

    @Transactional
    public void deleteSpace(String spaceId, String userId) {
        SpaceMember membership = requireMembership(spaceId, userId);
        if (!SpacePermissions.canDeleteSpace(membership.getRole())) {
            throw new ApiException("FORBIDDEN", "Only the Space owner can delete it", 403);
        }
        List<String> storedKeys = new ArrayList<>();
        for (Product product : productRepository.findBySpace(membership.getSpace())) {
            storedKeys.add(product.getBillKey());
            if (product.getCardKey() != null) storedKeys.add(product.getCardKey());
        }
        spaceRepository.delete(membership.getSpace());
        if (!storedKeys.isEmpty()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    storedKeys.forEach(storageService::delete);
                }
            });
        }
    }

    private SpaceMember requireMembership(String spaceId, String userId) {
        Space space = spaceRepository.findById(spaceId).orElseThrow(() -> new ApiException("NOT_FOUND", "Space not found", 404));
        User user = userRepository.findById(userId).orElseThrow(() -> new ApiException("NOT_FOUND", "User not found", 404));
        return spaceMemberRepository.findBySpaceAndUser(space, user)
            .orElseThrow(() -> new ApiException("NOT_FOUND", "Space not found", 404));
    }

    private SpaceResponse toResponse(Space space, String userId) {
        User viewer = userRepository.findById(userId).orElseThrow(() -> new ApiException("NOT_FOUND", "User not found", 404));
        SpaceRole role = spaceMemberRepository.findBySpaceAndUser(space, viewer)
            .orElseThrow(() -> new ApiException("NOT_FOUND", "Space not found", 404)).getRole();
        LocalDate today = LocalDate.now(clock.withZone(ZoneId.of(viewer.getTimezone())));
        int daysBefore = preferenceRepository.findById(userId).map(pref -> pref.getDaysBefore()).orElse(30);
        List<Product> products = productRepository.findBySpace(space);
        long expiringSoon = products.stream().filter(product -> {
            long days = java.time.temporal.ChronoUnit.DAYS.between(today, product.getExpiresOn());
            return days >= 0 && days <= daysBefore;
        }).count();
        long expired = products.stream().filter(product -> product.getExpiresOn().isBefore(today)).count();
        SpaceResponse.NextExpiry next = products.stream()
            .filter(product -> !product.getExpiresOn().isBefore(today))
            .min(java.util.Comparator.comparing(Product::getExpiresOn))
            .map(product -> new SpaceResponse.NextExpiry(product.getId(), product.getProductType() + " " + product.getBrand(), product.getExpiresOn()))
            .orElse(null);
        return new SpaceResponse(
            space.getId(),
            space.getName(),
            space.getDescription(),
            role,
            spaceMemberRepository.countBySpace(space),
            products.size(),
            next,
            expiringSoon,
            expired,
            space.getCreatedAt(),
            space.getUpdatedAt(),
            new SpaceResponse.Permissions(SpacePermissions.canDeleteSpace(role), SpacePermissions.canDeleteSpace(role),
                SpacePermissions.canManageMembers(role), SpacePermissions.canCreateProduct(role),
                SpacePermissions.canDeleteProduct(role))
        );
    }
}
