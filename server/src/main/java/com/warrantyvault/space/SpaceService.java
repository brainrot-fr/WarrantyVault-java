package com.warrantyvault.space;

import com.warrantyvault.common.ApiException;
import com.warrantyvault.common.UuidGenerator;
import com.warrantyvault.config.AppProperties;
import com.warrantyvault.member.SpaceMember;
import com.warrantyvault.member.SpaceMemberRepository;
import com.warrantyvault.product.Product;
import com.warrantyvault.product.ProductRepository;
import com.warrantyvault.storage.StorageService;
import com.warrantyvault.user.User;
import com.warrantyvault.user.UserRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.dao.DataIntegrityViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class SpaceService {
    private static final Logger logger = LoggerFactory.getLogger(SpaceService.class);
    private final SpaceRepository spaceRepository;
    private final UserRepository userRepository;
    private final SpaceMemberRepository spaceMemberRepository;
    private final ProductRepository productRepository;
    private final StorageService storageService;
    private final AppProperties appProperties;
    private final Clock clock;

    public SpaceService(SpaceRepository spaceRepository, UserRepository userRepository, SpaceMemberRepository spaceMemberRepository,
                        ProductRepository productRepository, StorageService storageService,
                        AppProperties appProperties, Clock clock) {
        this.spaceRepository = spaceRepository;
        this.userRepository = userRepository;
        this.spaceMemberRepository = spaceMemberRepository;
        this.productRepository = productRepository;
        this.storageService = storageService;
        this.appProperties = appProperties;
        this.clock = clock;
    }

    @Transactional
    public Space createSpace(String ownerId, String name, String description) {
        User owner = userRepository.findById(ownerId).orElseThrow(() -> new ApiException("NOT_FOUND", "User not found", 404));
        if (spaceRepository.existsByOwnerAndNameIgnoreCase(owner, name.trim())) {
            throw new ApiException("SPACE_EXISTS", "Space already exists", 409);
        }
        Space space = new Space();
        space.setId(UuidGenerator.nextId());
        space.setOwner(owner);
        space.setName(name.trim());
        space.setDescription(description);
        space.setCreatedAt(Instant.now(clock));
        space.setUpdatedAt(Instant.now(clock));
        Space saved;
        try {
            saved = spaceRepository.saveAndFlush(space);
        } catch (DataIntegrityViolationException exception) {
            throw new ApiException("SPACE_EXISTS", "Space already exists", 409);
        }

        SpaceMember member = new SpaceMember();
        member.setSpace(saved);
        member.setUser(owner);
        member.setRole(SpaceRole.OWNER);
        member.setAddedAt(Instant.now(clock));
        spaceMemberRepository.save(member);
        return saved;
    }

    @Transactional(readOnly = true)
    public List<SpaceResponse> listSpaceResponses(User viewer) {
        String userId = viewer.getId();
        List<SpaceMember> memberships = spaceMemberRepository.findByUserId(userId);
        if (memberships.isEmpty()) return List.of();
        List<String> spaceIds = memberships.stream().map(membership -> membership.getSpace().getId()).toList();
        LocalDate today = LocalDate.now(clock.withZone(ZoneId.of(viewer.getTimezone())));
        Map<String, SpaceProductAggregate> productAggregates = productRepository
            .findSpaceProductAggregates(userId, today, today.plusDays(appProperties.getExpiringSoonDays()))
            .stream().collect(Collectors.toMap(SpaceProductAggregate::spaceId, aggregate -> aggregate));
        Map<String, Long> memberCounts = spaceMemberRepository.countMembersBySpaceIds(spaceIds).stream()
            .collect(Collectors.toMap(SpaceMemberCount::spaceId, SpaceMemberCount::memberCount));
        Map<String, SpaceResponse.NextExpiry> nextExpiries = new HashMap<>();
        for (SpaceNextExpiry next : productRepository.findNextExpiryForUser(userId, today)) {
            nextExpiries.putIfAbsent(next.spaceId(),
                new SpaceResponse.NextExpiry(next.productId(), next.productType() + " " + next.brand(), next.expiresOn()));
        }
        return memberships.stream().map(membership -> {
            Space space = membership.getSpace();
            SpaceProductAggregate aggregate = productAggregates.get(space.getId());
            return toResponse(space, membership.getRole(), memberCounts.getOrDefault(space.getId(), 0L),
                aggregate, nextExpiries.get(space.getId()));
        }).toList();
    }

    @Transactional(readOnly = true)
    public SpaceResponse spaceResponse(String spaceId, User viewer) {
        SpaceMember membership = requireMembership(spaceId, viewer.getId());
        return toResponse(membership.getSpace(), viewer, membership.getRole());
    }

    @Transactional(readOnly = true)
    public SpaceResponse createdSpaceResponse(Space space, User viewer) {
        SpaceMember membership = requireMembership(space.getId(), viewer.getId());
        return toResponse(space, viewer, membership.getRole());
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
        if (!nextName.equalsIgnoreCase(space.getName())
            && spaceRepository.existsByOwnerAndNameIgnoreCase(space.getOwner(), nextName)) {
            throw new ApiException("SPACE_EXISTS", "A Space with this name already exists", 409);
        }
        space.setName(nextName);
        if (description != null) {
            String trimmed = description.trim();
            space.setDescription(trimmed.isEmpty() ? null : trimmed);
        }
        space.setUpdatedAt(Instant.now(clock));
        return spaceRepository.save(space);
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
                    for (String key : storedKeys) {
                        try {
                            storageService.delete(key);
                        } catch (RuntimeException exception) {
                            logger.warn("Could not remove deleted Space upload {}", key);
                        }
                    }
                }
            });
        }
    }

    private SpaceMember requireMembership(String spaceId, String userId) {
        return spaceMemberRepository.findBySpaceIdAndUserId(spaceId, userId)
            .orElseThrow(() -> new ApiException("NOT_FOUND", "Space not found", 404));
    }

    private SpaceResponse toResponse(Space space, User viewer, SpaceRole role) {
        LocalDate today = LocalDate.now(clock.withZone(ZoneId.of(viewer.getTimezone())));
        SpaceProductAggregate aggregate = productRepository.findSpaceProductAggregate(
            space.getId(), today, today.plusDays(appProperties.getExpiringSoonDays()));
        SpaceNextExpiry nextProduct = productRepository.findNextExpiryForSpace(
            space.getId(), today, PageRequest.of(0, 1)).stream().findFirst().orElse(null);
        SpaceResponse.NextExpiry next = nextProduct == null ? null :
            new SpaceResponse.NextExpiry(
                nextProduct.productId(), nextProduct.productType() + " " + nextProduct.brand(),
                nextProduct.expiresOn());
        return new SpaceResponse(
            space.getId(),
            space.getName(),
            space.getDescription(),
            role,
            spaceMemberRepository.countBySpace(space),
            aggregate.productCount(),
            next,
            aggregate.expiringSoonCount(),
            aggregate.expiredCount(),
            space.getCreatedAt(),
            space.getUpdatedAt(),
            new SpaceResponse.Permissions(SpacePermissions.canDeleteSpace(role), SpacePermissions.canDeleteSpace(role),
                SpacePermissions.canManageMembers(role), SpacePermissions.canCreateProduct(role),
                SpacePermissions.canDeleteProduct(role))
        );
    }

    private SpaceResponse toResponse(Space space, SpaceRole role, long memberCount,
                                     SpaceProductAggregate aggregate, SpaceResponse.NextExpiry next) {
        return new SpaceResponse(
            space.getId(), space.getName(), space.getDescription(), role, memberCount,
            aggregate == null ? 0 : aggregate.productCount(), next,
            aggregate == null || aggregate.expiringSoonCount() == null ? 0 : aggregate.expiringSoonCount(),
            aggregate == null || aggregate.expiredCount() == null ? 0 : aggregate.expiredCount(),
            space.getCreatedAt(), space.getUpdatedAt(),
            new SpaceResponse.Permissions(SpacePermissions.canDeleteSpace(role), SpacePermissions.canDeleteSpace(role),
                SpacePermissions.canManageMembers(role), SpacePermissions.canCreateProduct(role),
                SpacePermissions.canDeleteProduct(role))
        );
    }
}
