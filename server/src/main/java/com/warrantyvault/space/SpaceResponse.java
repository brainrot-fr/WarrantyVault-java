package com.warrantyvault.space;

import java.time.Instant;
import java.time.LocalDate;

public record SpaceResponse(
    String id,
    String name,
    String description,
    SpaceRole myRole,
    long memberCount,
    long productCount,
    NextExpiry nextExpiry,
    long expiringSoonCount,
    long expiredCount,
    Instant createdAt,
    Instant updatedAt,
    Permissions permissions
) {
    public record NextExpiry(String productId, String productLabel, LocalDate expiresOn) {}
    public record Permissions(
        boolean canEdit,
        boolean canDelete,
        boolean canManageMembers,
        boolean canCreateProducts,
        boolean canDeleteProducts
    ) {}
}
