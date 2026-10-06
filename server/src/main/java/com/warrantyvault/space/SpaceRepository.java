package com.warrantyvault.space;

import com.warrantyvault.user.User;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.Optional;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;

public interface SpaceRepository extends JpaRepository<Space, String> {
    boolean existsByOwnerAndName(User owner, String name);
    boolean existsByOwnerAndNameIgnoreCase(User owner, String name);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select space from Space space where space.id = :id")
    Optional<Space> findByIdForUpdate(String id);

    @Query("select s from Space s join SpaceMember sm on sm.space = s where sm.user.id = :userId")
    List<Space> findByUserId(String userId);
}
