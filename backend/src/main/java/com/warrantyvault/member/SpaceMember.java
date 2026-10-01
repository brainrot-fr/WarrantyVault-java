package com.warrantyvault.member;

import com.warrantyvault.space.Space;
import com.warrantyvault.space.SpaceRole;
import com.warrantyvault.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "space_members")
@IdClass(SpaceMemberId.class)
@Getter @Setter @NoArgsConstructor
public class SpaceMember {
    @Id
    @ManyToOne
    @JoinColumn(name = "space_id", nullable = false)
    private Space space;

    @Id
    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private SpaceRole role;

    @Column(name = "added_at", nullable = false)
    private Instant addedAt;
}

class SpaceMemberId implements Serializable {
    private String space;
    private String user;
}
