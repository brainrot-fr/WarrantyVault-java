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
import jakarta.persistence.FetchType;
import java.io.Serializable;
import java.util.Objects;
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
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "space_id", nullable = false)
    private Space space;

    @Id
    @ManyToOne(fetch = FetchType.LAZY)
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

    public SpaceMemberId() {}

    public SpaceMemberId(String space, String user) {
        this.space = space;
        this.user = user;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) return true;
        if (!(other instanceof SpaceMemberId that)) return false;
        return Objects.equals(space, that.space) && Objects.equals(user, that.user);
    }

    @Override
    public int hashCode() {
        return Objects.hash(space, user);
    }
}
