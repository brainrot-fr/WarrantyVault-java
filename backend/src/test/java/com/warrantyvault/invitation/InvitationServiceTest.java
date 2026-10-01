package com.warrantyvault.invitation;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.warrantyvault.common.ApiException;
import com.warrantyvault.config.AppProperties;
import com.warrantyvault.mail.MailService;
import com.warrantyvault.member.SpaceMember;
import com.warrantyvault.member.SpaceMemberRepository;
import com.warrantyvault.security.CurrentUser;
import com.warrantyvault.space.Space;
import com.warrantyvault.space.SpaceRepository;
import com.warrantyvault.space.SpaceRole;
import com.warrantyvault.user.User;
import com.warrantyvault.user.UserRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class InvitationServiceTest {
    private final InvitationRepository invitations = mock(InvitationRepository.class);
    private final SpaceMemberRepository members = mock(SpaceMemberRepository.class);
    private final CurrentUser currentUser = mock(CurrentUser.class);
    private final UserRepository users = mock(UserRepository.class);
    private final InvitationService service = new InvitationService(invitations, members, mock(SpaceRepository.class),
        users, currentUser, mock(MailService.class), new AppProperties(),
        Clock.fixed(Instant.parse("2026-10-01T00:00:00Z"), ZoneOffset.UTC));
    private final User invitee = user("invitee@example.test");
    private final Space space = new Space();

    InvitationServiceTest() {
        when(currentUser.get()).thenReturn(invitee);
        space.setId("space-id");
        space.setName("Home");
    }

    @Test
    void rejectsInvitationForExistingMember() {
        Invitation invitation = invitation("invitee@example.test", "PENDING", "2026-10-10T00:00:00Z");
        when(invitations.findById("invitation-id")).thenReturn(Optional.of(invitation));
        when(members.findBySpaceAndUser(space, invitee)).thenReturn(Optional.of(new SpaceMember()));

        ApiException error = assertThrows(ApiException.class, () -> service.acceptInvitation("invitation-id"));

        assertEquals("ALREADY_MEMBER", error.getCode());
        assertEquals(409, error.getStatus());
    }

    @Test
    void rejectsExpiredInvitation() {
        Invitation invitation = invitation("invitee@example.test", "PENDING", "2026-09-30T00:00:00Z");
        when(invitations.findById("invitation-id")).thenReturn(Optional.of(invitation));

        ApiException error = assertThrows(ApiException.class, () -> service.acceptInvitation("invitation-id"));

        assertEquals("INVITE_EXPIRED", error.getCode());
        assertEquals(409, error.getStatus());
    }

    @Test
    void hidesInvitationFromWrongUser() {
        when(invitations.findById("invitation-id"))
            .thenReturn(Optional.of(invitation("other@example.test", "PENDING", "2026-10-10T00:00:00Z")));

        ApiException error = assertThrows(ApiException.class, () -> service.acceptInvitation("invitation-id"));

        assertEquals("NOT_FOUND", error.getCode());
        assertEquals(404, error.getStatus());
    }

    @Test
    void rejectsRevokedInvitation() {
        when(invitations.findById("invitation-id"))
            .thenReturn(Optional.of(invitation("invitee@example.test", "REVOKED", "2026-10-10T00:00:00Z")));

        ApiException error = assertThrows(ApiException.class, () -> service.acceptInvitation("invitation-id"));

        assertEquals("NOT_FOUND", error.getCode());
        assertEquals(404, error.getStatus());
    }

    private Invitation invitation(String email, String status, String expiresAt) {
        Invitation invitation = new Invitation();
        invitation.setId("invitation-id");
        invitation.setSpace(space);
        invitation.setInvitedEmail(email);
        invitation.setRole(SpaceRole.VIEWER);
        invitation.setStatus(status);
        invitation.setExpiresAt(Instant.parse(expiresAt));
        return invitation;
    }

    private User user(String email) {
        User user = new User();
        user.setId("user-id");
        user.setEmail(email);
        user.setName("Invitee");
        return user;
    }
}
