package com.warrantyvault.member;

import com.warrantyvault.space.Space;
import com.warrantyvault.user.User;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SpaceMemberRepository extends JpaRepository<SpaceMember, SpaceMemberId> {
    List<SpaceMember> findByUser(User user);
    List<SpaceMember> findBySpace(Space space);
    Optional<SpaceMember> findBySpaceAndUser(Space space, User user);
    long countBySpace(Space space);
}
