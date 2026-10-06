package com.warrantyvault.member;

import com.warrantyvault.space.Space;
import com.warrantyvault.user.User;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SpaceMemberRepository extends JpaRepository<SpaceMember, SpaceMemberId> {
    @Query("select membership from SpaceMember membership join fetch membership.space join fetch membership.user "
        + "where membership.space.id = :spaceId and membership.user.id = :userId")
    Optional<SpaceMember> findBySpaceIdAndUserId(@Param("spaceId") String spaceId, @Param("userId") String userId);

    @Query("select membership from SpaceMember membership join fetch membership.user where membership.space = :space")
    List<SpaceMember> findMembersWithUserBySpace(@Param("space") com.warrantyvault.space.Space space);
    List<SpaceMember> findByUser(User user);
    @Query("select membership from SpaceMember membership join fetch membership.space where membership.user.id = :userId")
    List<SpaceMember> findByUserId(@Param("userId") String userId);
    List<SpaceMember> findBySpace(Space space);
    Optional<SpaceMember> findBySpaceAndUser(Space space, User user);
    long countBySpace(Space space);
    @Query("select new com.warrantyvault.space.SpaceMemberCount(membership.space.id, count(membership.user.id)) from SpaceMember membership where membership.space.id in :spaceIds group by membership.space.id")
    List<com.warrantyvault.space.SpaceMemberCount> countMembersBySpaceIds(@Param("spaceIds") List<String> spaceIds);
}
