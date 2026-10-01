package com.warrantyvault.invitation;

import com.warrantyvault.common.ApiException;
import com.warrantyvault.common.UuidGenerator;
import com.warrantyvault.config.AppProperties;
import com.warrantyvault.mail.MailService;
import com.warrantyvault.member.SpaceMember;
import com.warrantyvault.member.SpaceMemberRepository;
import com.warrantyvault.security.CurrentUser;
import com.warrantyvault.space.Space;
import com.warrantyvault.space.SpacePermissions;
import com.warrantyvault.space.SpaceRepository;
import com.warrantyvault.space.SpaceRole;
import com.warrantyvault.user.User;
import com.warrantyvault.user.UserRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
public class InvitationService {
    private static final Logger logger = LoggerFactory.getLogger(InvitationService.class);
    private final InvitationRepository invitationRepository;
    private final SpaceMemberRepository spaceMemberRepository;
    private final SpaceRepository spaceRepository;
    private final UserRepository userRepository;
    private final CurrentUser currentUser;
    private final MailService mailService;
    private final AppProperties appProperties;
    private final Clock clock;

    public InvitationService(InvitationRepository invitationRepository, SpaceMemberRepository spaceMemberRepository,
                             SpaceRepository spaceRepository, UserRepository userRepository, CurrentUser currentUser,
                             MailService mailService, AppProperties appProperties, Clock clock) {
        this.invitationRepository = invitationRepository;
        this.spaceMemberRepository = spaceMemberRepository;
        this.spaceRepository = spaceRepository;
        this.userRepository = userRepository;
        this.currentUser = currentUser;
        this.mailService = mailService;
        this.appProperties = appProperties;
        this.clock = clock;
    }

    @Transactional
    public InvitationView createInvitation(String spaceId, String email, SpaceRole role) {
        User inviter = currentUser.get();
        Space space = requireOwner(spaceId, inviter);
        if (role == null || role == SpaceRole.OWNER) {
            throw new ApiException("VALIDATION_FAILED", "Invitations must use EDITOR or VIEWER role", 400);
        }
        String normalizedEmail = email.trim().toLowerCase(Locale.ROOT);
        User invitee = userRepository.findByEmailIgnoreCase(normalizedEmail).orElse(null);
        if (invitee != null && spaceMemberRepository.findBySpaceAndUser(space, invitee).isPresent()) {
            throw new ApiException("ALREADY_MEMBER", "This person is already a member of the Space", 409);
        }
        Instant now = Instant.now(clock);
        boolean pending = invitationRepository.findBySpaceAndInvitedEmailAndStatus(space, normalizedEmail, "PENDING")
            .stream().anyMatch(invitation -> invitation.getExpiresAt().isAfter(now));
        if (pending) throw new ApiException("INVITATION_PENDING", "An invitation is already pending for this email", 409);

        Invitation invitation = new Invitation();
        invitation.setId(UuidGenerator.nextId());
        invitation.setSpace(space);
        invitation.setInvitedEmail(normalizedEmail);
        invitation.setRole(role);
        invitation.setInvitedBy(inviter);
        invitation.setStatus("PENDING");
        invitation.setCreatedAt(now);
        invitation.setExpiresAt(now.plusSeconds(14L * 24 * 60 * 60));
        Invitation saved = invitationRepository.save(invitation);
        InvitationView response = InvitationView.forDelivery(saved);
        String url = appProperties.getAppBaseUrl() + "/invitations";
        String roleText = role == SpaceRole.EDITOR ? "an editor" : "a viewer";
        String subject = inviter.getName() + " invited you to " + space.getName() + " on WarrantyVault";
        String plain = inviter.getName() + " invited you to join " + space.getName() + " as " + roleText
            + ". View and respond to the invitation at " + url;
        String html = "<div style=\"font:16px/1.6 Arial,sans-serif;color:#263238;max-width:560px;margin:auto\">"
            + "<h1 style=\"font-family:Georgia,serif;font-weight:400\">You’re invited</h1><p>"
            + escape(inviter.getName()) + " invited you to <strong>" + escape(space.getName())
            + "</strong> as " + roleText + ".</p><p><a href=\"" + escape(url)
            + "\" style=\"display:inline-block;background:#516b58;color:#fff;padding:12px 18px;text-decoration:none;border-radius:8px\">View invitation</a></p></div>";
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                try {
                    mailService.send(normalizedEmail, subject, plain, html);
                    response.setEmailSent(true);
                } catch (RuntimeException exception) {
                    logger.warn("Invitation email delivery failed for invitation {}: {}",
                        saved.getId(), exception.getClass().getSimpleName());
                }
            }
        });
        return response;
    }

    @Transactional(readOnly = true)
    public MemberListing members(String spaceId) {
        User viewer = currentUser.get();
        Space space = requireMemberSpace(spaceId, viewer);
        List<MemberView> members = spaceMemberRepository.findBySpace(space).stream().map(MemberView::from).toList();
        List<InvitationView> invitations = spaceMemberRepository.findBySpaceAndUser(space, viewer)
            .filter(member -> SpacePermissions.canManageMembers(member.getRole()))
            .map(member -> invitationRepository.findBySpaceAndStatus(space, "PENDING"))
            .orElse(List.of())
            .stream().filter(invitation -> invitation.getExpiresAt().isAfter(Instant.now(clock)))
            .map(InvitationView::from).toList();
        return new MemberListing(members, invitations);
    }

    @Transactional
    public void revokeInvitation(String spaceId, String invitationId) {
        User viewer = currentUser.get();
        Space space = requireOwner(spaceId, viewer);
        Invitation invitation = invitationRepository.findById(invitationId)
            .filter(item -> item.getSpace().getId().equals(space.getId()))
            .orElseThrow(() -> notFound());
        if ("PENDING".equals(invitation.getStatus())) {
            invitation.setStatus("REVOKED");
            invitation.setRespondedAt(Instant.now(clock));
        }
    }

    @Transactional
    public void changeMemberRole(String spaceId, String userId, SpaceRole role) {
        User viewer = currentUser.get();
        Space space = requireOwner(spaceId, viewer);
        if (role == null || role == SpaceRole.OWNER) throw new ApiException("VALIDATION_FAILED", "Role must be EDITOR or VIEWER", 400);
        User target = userRepository.findById(userId).orElseThrow(this::notFound);
        SpaceMember member = spaceMemberRepository.findBySpaceAndUser(space, target).orElseThrow(this::notFound);
        if (member.getRole() == SpaceRole.OWNER) throw new ApiException("FORBIDDEN", "The owner role cannot be changed", 403);
        member.setRole(role);
        spaceMemberRepository.save(member);
    }

    @Transactional
    public void removeMember(String spaceId, String userId) {
        User viewer = currentUser.get();
        Space space = requireMemberSpace(spaceId, viewer);
        User target = userRepository.findById(userId).orElseThrow(this::notFound);
        SpaceMember targetMember = spaceMemberRepository.findBySpaceAndUser(space, target).orElseThrow(this::notFound);
        SpaceMember viewerMember = spaceMemberRepository.findBySpaceAndUser(space, viewer).orElseThrow(this::notFound);
        if (targetMember.getRole() == SpaceRole.OWNER) {
            throw new ApiException("FORBIDDEN", "The owner cannot leave or be removed; delete the Space instead", 403);
        }
        if (viewerMember.getRole() != SpaceRole.OWNER && !viewer.getId().equals(target.getId())) {
            throw new ApiException("FORBIDDEN", "Members may only remove themselves", 403);
        }
        spaceMemberRepository.delete(targetMember);
    }

    @Transactional(readOnly = true)
    public List<InviteForUser> pendingForCurrentUser() {
        User user = currentUser.get();
        Instant now = Instant.now(clock);
        return invitationRepository.findByInviteeWithDetails(user.getEmail().toLowerCase(Locale.ROOT), "PENDING")
            .stream().filter(invitation -> invitation.getExpiresAt().isAfter(now))
            .map(InviteForUser::from).toList();
    }

    @Transactional
    public Space acceptInvitation(String invitationId) {
        User user = currentUser.get();
        Invitation invitation = invitationRepository.findById(invitationId).orElseThrow(this::notFound);
        requireInvitee(invitation, user);
        Instant now = Instant.now(clock);
        if (!"PENDING".equals(invitation.getStatus())) throw notFound();
        if (!invitation.getExpiresAt().isAfter(now)) {
            invitation.setStatus("REVOKED");
            invitation.setRespondedAt(now);
            throw new ApiException("INVITE_EXPIRED", "This invitation has expired", 409);
        }
        if (spaceMemberRepository.findBySpaceAndUser(invitation.getSpace(), user).isPresent()) {
            throw new ApiException("ALREADY_MEMBER", "You are already a member of this Space", 409);
        }
        SpaceMember member = new SpaceMember();
        member.setSpace(invitation.getSpace());
        member.setUser(user);
        member.setRole(invitation.getRole());
        member.setAddedAt(now);
        spaceMemberRepository.save(member);
        invitation.setStatus("ACCEPTED");
        invitation.setRespondedAt(now);
        invitationRepository.save(invitation);
        return invitation.getSpace();
    }

    @Transactional
    public void declineInvitation(String invitationId) {
        User user = currentUser.get();
        Invitation invitation = invitationRepository.findById(invitationId).orElseThrow(this::notFound);
        requireInvitee(invitation, user);
        Instant now = Instant.now(clock);
        if (!"PENDING".equals(invitation.getStatus()) || !invitation.getExpiresAt().isAfter(now)) throw notFound();
        invitation.setStatus("DECLINED");
        invitation.setRespondedAt(now);
    }

    private Space requireOwner(String spaceId, User user) {
        Space space = requireMemberSpace(spaceId, user);
        SpaceMember member = spaceMemberRepository.findBySpaceAndUser(space, user).orElseThrow(this::notFound);
        if (!SpacePermissions.canManageMembers(member.getRole())) {
            throw new ApiException("FORBIDDEN", "Only the owner can manage members", 403);
        }
        return space;
    }

    private Space requireMemberSpace(String spaceId, User user) {
        Space space = spaceRepository.findById(spaceId).orElseThrow(this::notFound);
        if (spaceMemberRepository.findBySpaceAndUser(space, user).isEmpty()) throw notFound();
        return space;
    }

    private void requireInvitee(Invitation invitation, User user) {
        if (!invitation.getInvitedEmail().equalsIgnoreCase(user.getEmail())) throw notFound();
    }

    private ApiException notFound() { return new ApiException("NOT_FOUND", "Resource not found", 404); }

    private String escape(String value) {
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            .replace("\"", "&quot;").replace("'", "&#39;");
    }

    public record MemberListing(List<MemberView> members, List<InvitationView> invitations) {}
    public record MemberView(String userId, String name, String email, SpaceRole role, Instant addedAt) {
        static MemberView from(SpaceMember member) {
            return new MemberView(member.getUser().getId(), member.getUser().getName(), member.getUser().getEmail(), member.getRole(), member.getAddedAt());
        }
    }
    public static final class InvitationView {
        private final String id;
        private final String email;
        private final SpaceRole role;
        private final String status;
        private final Instant createdAt;
        private final Instant expiresAt;
        private boolean emailSent;

        private InvitationView(String id, String email, SpaceRole role, String status, Instant createdAt,
                               Instant expiresAt, boolean emailSent) {
            this.id = id;
            this.email = email;
            this.role = role;
            this.status = status;
            this.createdAt = createdAt;
            this.expiresAt = expiresAt;
            this.emailSent = emailSent;
        }

        static InvitationView from(Invitation invitation) {
            return new InvitationView(invitation.getId(), invitation.getInvitedEmail(), invitation.getRole(),
                invitation.getStatus(), invitation.getCreatedAt(), invitation.getExpiresAt(), true);
        }

        static InvitationView forDelivery(Invitation invitation) {
            return new InvitationView(invitation.getId(), invitation.getInvitedEmail(), invitation.getRole(),
                invitation.getStatus(), invitation.getCreatedAt(), invitation.getExpiresAt(), false);
        }

        public String getId() { return id; }
        public String getEmail() { return email; }
        public SpaceRole getRole() { return role; }
        public String getStatus() { return status; }
        public Instant getCreatedAt() { return createdAt; }
        public Instant getExpiresAt() { return expiresAt; }
        public boolean isEmailSent() { return emailSent; }
        void setEmailSent(boolean emailSent) { this.emailSent = emailSent; }
    }
    public record InviteForUser(String id, String spaceName, String invitedByName, SpaceRole role, Instant createdAt, Instant expiresAt) {
        static InviteForUser from(Invitation invitation) {
            return new InviteForUser(invitation.getId(), invitation.getSpace().getName(), invitation.getInvitedBy().getName(),
                invitation.getRole(), invitation.getCreatedAt(), invitation.getExpiresAt());
        }
    }
}
