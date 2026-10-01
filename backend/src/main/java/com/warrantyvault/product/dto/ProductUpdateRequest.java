package com.warrantyvault.product.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record ProductUpdateRequest(
    @NotBlank @Size(max = 60) String productType,
    @NotBlank @Size(max = 60) String brand,
    @Size(max = 120) String modelName,
    @Size(max = 120) String serialNumber,
    @NotBlank @Pattern(regexp = "^\\d{4}-\\d{2}-\\d{2}$") String purchasedOn,
    @NotNull @Min(1) @Max(120) Integer warrantyMonths,
    @NotBlank @DecimalMin("0.00") @Digits(integer = 10, fraction = 2) String purchasePrice,
    @Pattern(regexp = "^[A-Za-z]{3}$") String currency,
    @Size(max = 1000) String notes,
    boolean removeWarrantyCard
) {
    public ProductCreateRequest asCreateRequest() {
        return new ProductCreateRequest(productType, brand, modelName, serialNumber, purchasedOn,
            warrantyMonths, purchasePrice, currency, notes);
    }
}
