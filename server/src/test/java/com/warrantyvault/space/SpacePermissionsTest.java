package com.warrantyvault.space;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class SpacePermissionsTest {
    @Test
    void ownerCanManageEverySpaceActionButCannotLeave() {
        assertTrue(SpacePermissions.canView(SpaceRole.OWNER));
        assertTrue(SpacePermissions.canCreateProduct(SpaceRole.OWNER));
        assertTrue(SpacePermissions.canEditProduct(SpaceRole.OWNER));
        assertTrue(SpacePermissions.canDeleteProduct(SpaceRole.OWNER));
        assertTrue(SpacePermissions.canDeleteSpace(SpaceRole.OWNER));
        assertTrue(SpacePermissions.canManageMembers(SpaceRole.OWNER));
        assertFalse(SpacePermissions.canLeave(SpaceRole.OWNER));
    }

    @Test
    void editorCanMaintainProductsAndLeaveButCannotDeleteOrManageSpace() {
        assertTrue(SpacePermissions.canView(SpaceRole.EDITOR));
        assertTrue(SpacePermissions.canCreateProduct(SpaceRole.EDITOR));
        assertTrue(SpacePermissions.canEditProduct(SpaceRole.EDITOR));
        assertFalse(SpacePermissions.canDeleteProduct(SpaceRole.EDITOR));
        assertFalse(SpacePermissions.canDeleteSpace(SpaceRole.EDITOR));
        assertFalse(SpacePermissions.canManageMembers(SpaceRole.EDITOR));
        assertTrue(SpacePermissions.canLeave(SpaceRole.EDITOR));
    }

    @Test
    void viewerCanOnlyReadAndLeave() {
        assertTrue(SpacePermissions.canView(SpaceRole.VIEWER));
        assertFalse(SpacePermissions.canCreateProduct(SpaceRole.VIEWER));
        assertFalse(SpacePermissions.canEditProduct(SpaceRole.VIEWER));
        assertFalse(SpacePermissions.canDeleteProduct(SpaceRole.VIEWER));
        assertFalse(SpacePermissions.canDeleteSpace(SpaceRole.VIEWER));
        assertFalse(SpacePermissions.canManageMembers(SpaceRole.VIEWER));
        assertTrue(SpacePermissions.canLeave(SpaceRole.VIEWER));
    }

    @Test
    void missingMembershipCannotViewOrLeave() {
        assertFalse(SpacePermissions.canView(null));
        assertFalse(SpacePermissions.canLeave(null));
    }
}
