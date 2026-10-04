package com.warrantyvault.space;

import com.warrantyvault.user.User;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface SpaceRepository extends JpaRepository<Space, String> {
    boolean existsByOwnerAndName(User owner, String name);

    @Query("select s from Space s join SpaceMember sm on sm.space = s where sm.user.id = :userId")
    List<Space> findByUserId(String userId);
}
