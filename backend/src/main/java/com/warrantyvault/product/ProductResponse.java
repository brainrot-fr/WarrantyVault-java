package com.warrantyvault.product;

import com.warrantyvault.space.SpacePermissions;
import com.warrantyvault.space.SpaceRole;
import java.time.Instant;
import java.time.LocalDate;

public record ProductResponse(
    String id,
    String spaceId,
    String spaceName,
    String productType,
    String brand,
    String modelName,
    String serialNumber,
    LocalDate purchasedOn,
    Integer warrantyMonths,
    LocalDate expiresOn,
    String purchasePrice,
    String currency,
    String notes,
    String status,
    long daysRemaining,
    double warrantyElapsedFraction,
    boolean hasWarrantyCard,
    FileInfo bill,
    FileInfo warrantyCard,
    Creator createdBy,
    Instant createdAt,
    Instant updatedAt,
    Permissions permissions
) {
    public static final int EXPIRING_SOON_DAYS = 30;

    public record FileInfo(String contentType, long sizeBytes) {}
    public record Creator(String id, String name) {}
    public record Permissions(boolean canEdit, boolean canDelete) {}

    public static ProductResponse from(Product product, SpaceRole role, LocalDate today) {
        long daysRemaining = java.time.temporal.ChronoUnit.DAYS.between(today, product.getExpiresOn());
        String status = daysRemaining < 0 ? "EXPIRED"
            : daysRemaining <= EXPIRING_SOON_DAYS ? "EXPIRING_SOON" : "ACTIVE";
        long totalDays = Math.max(1, java.time.temporal.ChronoUnit.DAYS.between(product.getPurchasedOn(), product.getExpiresOn()));
        long elapsedDays = java.time.temporal.ChronoUnit.DAYS.between(product.getPurchasedOn(), today);
        double elapsedFraction = Math.max(0, Math.min(1, elapsedDays / (double) totalDays));
        boolean hasCard = product.getCardKey() != null;
        return new ProductResponse(
            product.getId(),
            product.getSpace().getId(),
            product.getSpace().getName(),
            product.getProductType(),
            product.getBrand(),
            product.getModelName(),
            product.getSerialNumber(),
            product.getPurchasedOn(),
            product.getWarrantyMonths(),
            product.getExpiresOn(),
            product.getPurchasePrice().toPlainString(),
            product.getCurrency(),
            product.getNotes(),
            status,
            daysRemaining,
            elapsedFraction,
            hasCard,
            new FileInfo(product.getBillContentType(), product.getBillSizeBytes()),
            hasCard ? new FileInfo(product.getCardContentType(), product.getCardSizeBytes()) : null,
            new Creator(product.getCreatedBy().getId(), product.getCreatedBy().getName()),
            product.getCreatedAt(),
            product.getUpdatedAt(),
            new Permissions(SpacePermissions.canEditProduct(role), SpacePermissions.canDeleteProduct(role))
        );
    }
}
