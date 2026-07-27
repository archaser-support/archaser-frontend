/**
 * Permission Dependencies Configuration
 * 
 * Defines logical dependencies between permissions where certain permissions
 * require other permissions to be enabled. For example, you cannot edit
 * users if you cannot view users.
 * 
 * Structure:
 * - Key: The prerequisite permission (must be enabled)
 * - Value: Array of permissions that depend on the key
 */

export interface PermissionDependency {
    prerequisite: string;
    dependents: string[];
    description?: string;
}

/**
 * Permission dependency rules
 * Maps prerequisite permissions to their dependent permissions
 */
export const PERMISSION_DEPENDENCIES: Record<string, string[]> = {
    // Note: manage_users and view_users are now independent - no dependency

    // Activity Sequences: All sequence operations require view_activity_sequences
    view_activity_sequences: [
        "manage_activity_sequence",
        "manage_sequence_container",
    ],

    // Business Units: Manage requires view
    view_business_units: [
        "manage_business_units",
    ],


    // Contacts: All contact operations require view_contacts
    view_contacts: [
        "manage_contacts",
    ],

    // Templates: Edit requires view (you can't edit what you can't view)
    view_templates: [
        "edit_templates",
    ],

    // Bank Accounts: Edit requires view (you can't edit what you can't view)
    view_banks: [
        "edit_bank_account",
    ],

    // Credit insurance policies: updating requires Settings access
    view_settings: [
        "update_insurance_policy",
    ],

    // Security Roles: Manage requires view (you can't manage what you can't view)
    view_roles: [
        "manage_security_role",
    ],

    // Activity Management: Edit and delete require create (logical workflow)
    // Note: create_log_activity might be a prerequisite for create_activity
    // but this depends on business logic - uncomment if needed:
    // create_log_activity: ["create_activity"],

    // Disputes: Edit and cancel require create (you can't edit/cancel what you can't create)
    // Note: There's no view_disputes in the current permission set, but if added:
    // view_disputes: ["create_dispute", "edit_dispute", "cancel_dispute"],
    create_dispute: [
        "edit_dispute",
        "cancel_dispute",
    ],
};

/**
 * Get all permissions that depend on a given permission
 * @param permission The prerequisite permission
 * @returns Array of dependent permission keys
 */
export function getDependentPermissions(permission: string): string[] {
    return PERMISSION_DEPENDENCIES[permission] || [];
}

/**
 * Get all prerequisites for a given permission
 * @param permission The permission to check
 * @returns Array of prerequisite permission keys
 */
export function getPrerequisites(permission: string): string[] {
    const prerequisites: string[] = [];

    for (const [prerequisite, dependents] of Object.entries(PERMISSION_DEPENDENCIES)) {
        if (dependents.includes(permission)) {
            prerequisites.push(prerequisite);
        }
    }

    return prerequisites;
}

/**
 * Check if a permission can be enabled given the current set of enabled permissions
 * @param permission The permission to check
 * @param enabledPermissions Set of currently enabled permissions
 * @returns Object with canEnable flag and missing prerequisites
 */
export function canEnablePermission(
    permission: string,
    enabledPermissions: Set<string>
): { canEnable: boolean; missingPrerequisites: string[] } {
    const prerequisites = getPrerequisites(permission);
    const missingPrerequisites = prerequisites.filter(
        (prereq) => !enabledPermissions.has(prereq)
    );

    return {
        canEnable: missingPrerequisites.length === 0,
        missingPrerequisites,
    };
}

/**
 * Get all permissions that should be disabled when a prerequisite is disabled
 * @param permission The prerequisite permission being disabled
 * @param enabledPermissions Current set of enabled permissions
 * @returns Array of permissions that should be automatically disabled
 */
export function getPermissionsToDisable(
    permission: string,
    enabledPermissions: Set<string>
): string[] {
    const dependents = getDependentPermissions(permission);

    // Return only those dependents that are currently enabled
    return dependents.filter((dep) => enabledPermissions.has(dep));
}

/**
 * Validate a set of permissions and return any violations
 * @param permissions Set of enabled permissions
 * @returns Array of violations, each containing the permission and its missing prerequisites
 */
export function validatePermissions(permissions: Set<string>): Array<{
    permission: string;
    missingPrerequisites: string[];
}> {
    const violations: Array<{ permission: string; missingPrerequisites: string[] }> = [];

    // Convert Set to Array for iteration
    const permissionsArray = Array.from(permissions);
    for (const permission of permissionsArray) {
        const { canEnable, missingPrerequisites } = canEnablePermission(permission, permissions);
        if (!canEnable) {
            violations.push({ permission, missingPrerequisites });
        }
    }

    return violations;
}

/**
 * Auto-fix permissions by removing dependent permissions when prerequisites are missing
 * @param permissions Set of permissions to fix
 * @returns Fixed set of permissions
 */
export function autoFixPermissions(permissions: Set<string>): Set<string> {
    const fixed = new Set(permissions);
    const violations = validatePermissions(fixed);

    // Remove permissions that violate dependencies
    for (const violation of violations) {
        fixed.delete(violation.permission);
    }

    return fixed;
}


