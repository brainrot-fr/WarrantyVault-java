package com.warrantyvault.invitation;

import com.warrantyvault.space.SpaceRole;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.List;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@Validated
public class InvitationController {
    private final InvitationService invitationService;

    @GetMapping("/invitations")
    public List<InvitationService.InviteForUser> listInvitations() {
        return invitationService.pendingForCurrentUser();
    }

    @PostMapping("/invitations/{id}/accept")
    public ResponseEntity<InvitationService.AcceptedSpace> accept(@PathVariable String id) {
        return ResponseEntity.ok(invitationService.acceptInvitation(id));
    }

    @PostMapping("/invitations/{id}/decline")
    public ResponseEntity<Void> decline(@PathVariable String id) {
        invitationService.declineInvitation(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/spaces/{spaceId}/members")
    public InvitationService.MemberListing members(@PathVariable String spaceId) {
        return invitationService.members(spaceId);
    }

    @PostMapping("/spaces/{spaceId}/invitations")
    public ResponseEntity<InvitationService.InvitationView> invite(@PathVariable String spaceId,
                                                                    @Valid @RequestBody CreateInvitationRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(invitationService.createInvitation(spaceId, request.email(), request.role()));
    }

    @DeleteMapping("/spaces/{spaceId}/invitations/{invitationId}")
    public ResponseEntity<Void> revoke(@PathVariable String spaceId, @PathVariable String invitationId) {
        invitationService.revokeInvitation(spaceId, invitationId);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/spaces/{spaceId}/members/{userId}")
    public ResponseEntity<Void> changeRole(@PathVariable String spaceId, @PathVariable String userId,
                                           @Valid @RequestBody ChangeRoleRequest request) {
        invitationService.changeMemberRole(spaceId, userId, request.role());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/spaces/{spaceId}/members/{userId}")
    public ResponseEntity<Void> removeMember(@PathVariable String spaceId, @PathVariable String userId) {
        invitationService.removeMember(spaceId, userId);
        return ResponseEntity.noContent().build();
    }

    public record CreateInvitationRequest(@Email @NotNull String email, @NotNull SpaceRole role) {}
    public record ChangeRoleRequest(@NotNull SpaceRole role) {}
}
