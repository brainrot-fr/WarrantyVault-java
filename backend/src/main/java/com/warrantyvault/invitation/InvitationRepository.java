package com.warrantyvault.invitation;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import com.warrantyvault.space.Space;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface InvitationRepository extends JpaRepository<Invitation, String> {
    List<Invitation> findByInvitedEmailAndStatus(String invitedEmail, String status);
    @Query("select invitation from Invitation invitation join fetch invitation.space join fetch invitation.invitedBy where invitation.invitedEmail = :email and invitation.status = :status")
    List<Invitation> findByInviteeWithDetails(@Param("email") String email, @Param("status") String status);
    List<Invitation> findBySpaceAndStatus(Space space, String status);
    List<Invitation> findBySpaceAndInvitedEmailAndStatus(Space space, String invitedEmail, String status);
}
