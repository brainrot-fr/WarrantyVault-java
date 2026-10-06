package com.warrantyvault.security;

import java.util.Optional;
import java.util.List;
import java.time.Instant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, String> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select token from RefreshToken token where token.tokenHash = :tokenHash")
    Optional<RefreshToken> findByTokenHashForUpdate(@Param("tokenHash") String tokenHash);
    List<RefreshToken> findByFamilyId(String familyId);
    List<RefreshToken> findByUserId(String userId);
    @org.springframework.data.jpa.repository.Modifying
    @Query("delete from RefreshToken token where token.expiresAt < :cutoff or token.revokedAt < :cutoff")
    int deleteStale(@Param("cutoff") Instant cutoff);
}
