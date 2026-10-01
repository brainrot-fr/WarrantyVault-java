package com.warrantyvault.invitation;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import com.warrantyvault.space.Space;

public interface InvitationRepository extends JpaRepository<Invitation, String> {
    List<Invitation> findByInvitedEmailAndStatus(String invitedEmail, String status);
    List<Invitation> findBySpaceAndStatus(Space space, String status);
    List<Invitation> findBySpaceAndInvitedEmailAndStatus(Space space, String invitedEmail, String status);
}
