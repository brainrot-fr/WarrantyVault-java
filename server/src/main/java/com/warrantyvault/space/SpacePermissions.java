package com.warrantyvault.space;

import java.util.EnumSet;
import java.util.Set;

public final class SpacePermissions {
    private SpacePermissions() {}

    public static final Set<SpaceRole> OWNER = EnumSet.of(SpaceRole.OWNER);
    public static final Set<SpaceRole> EDITOR = EnumSet.of(SpaceRole.EDITOR);
    public static final Set<SpaceRole> VIEWER = EnumSet.of(SpaceRole.VIEWER);

    public static boolean canView(SpaceRole role) { return role != null; }
    public static boolean canCreateProduct(SpaceRole role) { return role == SpaceRole.OWNER || role == SpaceRole.EDITOR; }
    public static boolean canEditProduct(SpaceRole role) { return role == SpaceRole.OWNER || role == SpaceRole.EDITOR; }
    public static boolean canDeleteProduct(SpaceRole role) { return role == SpaceRole.OWNER; }
    public static boolean canDeleteSpace(SpaceRole role) { return role == SpaceRole.OWNER; }
    public static boolean canManageMembers(SpaceRole role) { return role == SpaceRole.OWNER; }
    public static boolean canLeave(SpaceRole role) { return role == SpaceRole.EDITOR || role == SpaceRole.VIEWER; }
}
