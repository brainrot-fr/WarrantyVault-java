package com.warrantyvault.space;

public record SpaceProductAggregate(String spaceId, long productCount, Long expiringSoonCount, Long expiredCount) {}
