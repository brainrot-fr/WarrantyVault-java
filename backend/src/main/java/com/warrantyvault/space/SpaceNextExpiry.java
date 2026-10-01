package com.warrantyvault.space;

import java.time.LocalDate;

public record SpaceNextExpiry(String spaceId, String productId, String productType, String brand, LocalDate expiresOn) {}
