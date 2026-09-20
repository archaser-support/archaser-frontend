"use client";

import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SearchIcon from "@mui/icons-material/Search";
import SecurityIcon from "@mui/icons-material/Security";
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Box,
    Breadcrumbs,
    Button,
    Chip,
    CircularProgress,
    FormControlLabel,
    IconButton,
    InputAdornment,
    Link,
    Paper,
    Stack,
    Switch,
    TextField,
    Tooltip,
    Typography,
    useTheme,
} from "@mui/material";
import { alpha, type Theme } from "@mui/material/styles";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/app/api";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import PageHeader from "@/components/PageHeader";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import {
    autoFixPermissions,
    canEnablePermission,
    getPermissionsToDisable,
} from "@/shared/utility/permissionDependencies";

interface RolePermissionsProps {
    role: string;
    accountId?: number;
}

interface PermissionSubcategory {
    key: string;
    label: string;
    permissions: string[];
}

interface PermissionCategory {
    key: string;
    label: string;
    subcategories: PermissionSubcategory[];
    permissions: string[]; // Flattened list for backward compatibility
}

const PERMISSIONS_SEARCH_WIDTH = { xs: 180, sm: 220, md: 280 } as const;

const SUBCATEGORY_PERMISSIONS_GRID_SX = {
    display: "grid",
    gridTemplateColumns: {
        xs: "1fr",
        sm: "repeat(2, 1fr)",
        md: "repeat(3, 1fr)",
    },
    gap: 2,
    bgcolor: "background.default",
} as const;

function collectUniquePermissions(categories: PermissionCategory[]): Set<string> {
    const unique = new Set<string>();
    for (const category of categories) {
        for (const subcategory of category.subcategories) {
            for (const permission of subcategory.permissions) {
                unique.add(permission);
            }
        }
    }
    return unique;
}

function toggleSetItem<T>(set: Set<T>, item: T): Set<T> {
    const next = new Set(set);
    if (next.has(item)) {
        next.delete(item);
    } else {
        next.add(item);
    }
    return next;
}

function breadcrumbTextSx(isHebrew: boolean) {
    return {
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        minWidth: 0,
        flexShrink: 1,
        display: "block",
        maxWidth: "none",
        direction: isHebrew ? "rtl" : "ltr",
        textAlign: isHebrew ? "right" : "left",
    };
}

function breadcrumbLinkSx(isHebrew: boolean) {
    return {
        ...breadcrumbTextSx(isHebrew),
        textDecoration: "none",
        color: "primary.main",
        cursor: "pointer",
        "&:hover": { textDecoration: "underline" },
    };
}

function permissionsSearchFieldSx(
    theme: Theme,
    searchDirection: "ltr" | "rtl"
) {
    const toolbarInputHeightPx = theme.appButton.toolbarControl.height;
    const toolbarInputLineHeightPx = toolbarInputHeightPx - 2;

    return {
        height: `${toolbarInputHeightPx}px`,
        minHeight: `${toolbarInputHeightPx}px`,
        maxHeight: `${toolbarInputHeightPx}px`,
        margin: 0,
        marginBottom: 0,
        padding: 0,
        display: "inline-flex",
        alignItems: "center",
        alignSelf: "center",
        flexShrink: 0,
        boxSizing: "border-box",
        "& .MuiOutlinedInput-root, & .MuiInputBase-root": {
            direction: searchDirection,
            backgroundColor: theme.palette.background.paper,
            padding: "0 !important",
            height: `${toolbarInputHeightPx}px !important`,
            minHeight: `${toolbarInputHeightPx}px !important`,
            maxHeight: `${toolbarInputHeightPx}px !important`,
            boxSizing: "border-box",
            "& fieldset, & .MuiOutlinedInput-notchedOutline": {
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                margin: 0,
                padding: 0,
                borderColor: theme.palette.divider,
                borderWidth: "1px",
            },
            "&:hover fieldset": {
                borderColor: theme.palette.divider,
            },
            "&.Mui-focused fieldset": {
                borderColor: theme.palette.primary.main,
                borderWidth: "1px",
            },
            "&.MuiInputBase-adornedStart": {
                paddingInlineStart: `${theme.spacing(1)} !important`,
                paddingInlineEnd: "0 !important",
                gap: theme.spacing(0.5),
            },
            "&.MuiInputBase-adornedEnd": {
                paddingInlineEnd: `${theme.spacing(1)} !important`,
                paddingInlineStart: "0 !important",
            },
        },
        "& .MuiInputBase-root.input-toolbar-height .MuiInputBase-input, & .MuiInputBase-root.input-toolbar-height .MuiOutlinedInput-input, & .MuiInputBase-root.input-toolbar-height input.MuiInputBase-inputSizeSmall":
            {
                direction: searchDirection,
                textAlign: searchDirection === "rtl" ? "right" : "left",
                flex: "1 1 auto",
                minWidth: 0,
                height: `${toolbarInputLineHeightPx}px !important`,
                minHeight: `${toolbarInputLineHeightPx}px !important`,
                maxHeight: `${toolbarInputLineHeightPx}px !important`,
                margin: "0 !important",
                padding: "0 !important",
                paddingInlineEnd: "8px !important",
                lineHeight: `${toolbarInputLineHeightPx}px !important`,
                fontSize: { xs: "0.75rem", sm: "0.8125rem", md: "0.875rem" },
                boxSizing: "border-box",
                alignSelf: "center",
                appearance: "none",
                WebkitAppearance: "none",
                "&::placeholder": {
                    textAlign: searchDirection === "rtl" ? "right" : "left",
                    direction: searchDirection,
                    lineHeight: `${toolbarInputLineHeightPx}px`,
                    opacity: 1,
                },
            },
        "& .MuiInputAdornment-root": {
            margin: "0 !important",
            paddingTop: 0,
            paddingBottom: 0,
            height: "auto !important",
            maxHeight: "none !important",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            alignSelf: "center",
            flexShrink: 0,
            minWidth: "auto",
            width: "auto",
            "& > span.notranslate": {
                display: "none",
                width: 0,
                minWidth: 0,
            },
        },
        "& .MuiInputAdornment-positionStart": {
            margin: "0 !important",
            marginInlineEnd: theme.spacing(0.5),
            paddingInlineStart: theme.spacing(1),
            minWidth: "auto",
            width: "auto",
        },
        "& .MuiInputAdornment-positionEnd": {
            margin: "0 !important",
            paddingInlineEnd: theme.spacing(1),
            minWidth: "auto",
            width: "auto",
        },
        "& .MuiSvgIcon-root": {
            fontSize: { xs: "0.9rem", sm: "1rem", md: "1.1rem" },
        },
    };
}

function expandAllButtonSx(theme: Theme, isHebrew: boolean) {
    return {
        minWidth: "auto",
        px: theme.spacing(1.5),
        height: "32px",
        boxSizing: "border-box",
        whiteSpace: "nowrap",
        direction: isHebrew ? "rtl" : "ltr",
        border: `1px solid ${theme.palette.divider} !important`,
        color: `${theme.palette.primary.main} !important`,
        backgroundColor: `${theme.palette.background.paper} !important`,
        "&:hover": {
            borderColor: `${theme.palette.primary.main} !important`,
            backgroundColor: `${alpha(theme.palette.primary.main, 0.04)} !important`,
        },
    };
}

function permissionFormControlSx(
    theme: Theme,
    isHebrew: boolean,
    switchDisabled: boolean
) {
    return {
        m: 0,
        width: "100%",
        opacity: switchDisabled ? 0.6 : 1,
        direction: isHebrew ? "rtl" : "ltr",
        justifyContent: "flex-start",
        p: 1,
        cursor: switchDisabled ? "not-allowed" : "default",
        "& .MuiFormControlLabel-label": {
            marginLeft: isHebrew ? 0 : theme.spacing(1),
            marginRight: isHebrew ? theme.spacing(1) : 0,
        },
    };
}

interface PermissionsSearchFieldProps {
    value: string;
    onChange: (value: string) => void;
    isHebrew: boolean;
}

function BreadcrumbNavLink({
    children,
    onClick,
    isHebrew,
}: {
    children: React.ReactNode;
    onClick: () => void;
    isHebrew: boolean;
}) {
    return (
        <Link
            component="button"
            variant="body1"
            onClick={onClick}
            sx={breadcrumbLinkSx(isHebrew)}
        >
            {children}
        </Link>
    );
}

function PermissionsSearchField({
    value,
    onChange,
    isHebrew,
}: PermissionsSearchFieldProps) {
    const theme = useTheme();
    const { t } = useTranslation("common");
    const searchDirection = isHebrew ? "rtl" : "ltr";

    const searchIconAdornment = useMemo(
        () => (
            <InputAdornment
                position="start"
                sx={{
                    marginInlineEnd: theme.spacing(0.5),
                    paddingInlineStart: theme.spacing(1),
                    minWidth: "auto",
                    width: "auto",
                }}
            >
                <Box
                    sx={{
                        padding: 0,
                        borderRadius: "4px",
                        width: 20,
                        height: 20,
                        minWidth: 20,
                        minHeight: 20,
                        color: theme.palette.primary.main,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <SearchIcon fontSize="small" />
                </Box>
            </InputAdornment>
        ),
        [theme]
    );

    return (
        <TextField
            className="toolbar-search-field"
            margin="none"
            size="small"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={t("fields.search_placeholder")}
            fullWidth
            dir={searchDirection}
            {...(isHebrew && { "data-rtl": true, "data-hebrew": true })}
            sx={permissionsSearchFieldSx(theme, searchDirection)}
            inputProps={{
                dir: searchDirection,
                style: {
                    textAlign: searchDirection === "rtl" ? "right" : "left",
                    direction: searchDirection,
                },
            }}
            slotProps={{
                input: {
                    className: "input-toolbar-height",
                    startAdornment: searchIconAdornment,
                    endAdornment: value ? (
                        <InputAdornment
                            position="end"
                            sx={{
                                paddingInlineEnd: theme.spacing(1),
                                minWidth: "auto",
                                width: "auto",
                            }}
                        >
                            <IconButton
                                color="primary"
                                onClick={() => onChange("")}
                                edge="end"
                                size="small"
                                aria-label="Clear search"
                                sx={{
                                    padding: theme.spacing(0.5),
                                    margin: 0,
                                    "&:hover": {
                                        backgroundColor: alpha(
                                            theme.palette.primary.main,
                                            0.08
                                        ),
                                    },
                                }}
                            >
                                <CloseIcon fontSize="small" />
                            </IconButton>
                        </InputAdornment>
                    ) : undefined,
                },
            }}
        />
    );
}

export default function RolePermissions({
    role,
    accountId: propAccountId,
}: RolePermissionsProps) {
    const { t, i18n } = useTranslation([
        "security_roles",
        "common",
        "settings",
        "accounts",
    ]);
    const { data: session } = useSession();
    const router = useRouter();
    const theme = useTheme();
    const isHebrew = i18n.language === "he";
    const pillRadiusPx = `${theme.appButton.sizeMedium.borderRadius}px`;
    const { success, error: showError } = useToast();
    const queryClient = useQueryClient();
    const accountId = propAccountId || session?.user?.account_id || 0;

    const getPermissionLabel = useCallback(
        (permissionKey: string) => {
            if (permissionKey === "view_follow_up_reminders") {
                return "View Subordinate Follow-up Reminders";
            }
            if (permissionKey === "view_credit_dashboard") {
                return "View Credit Insurance Dashboard";
            }
            if (permissionKey === "update_insurance_policy") {
                return "Update insurance policy";
            }
            return t(`fields.${permissionKey}`, {
                ns: "security_roles",
                defaultValue: permissionKey,
            });
        },
        [t]
    );

    // Fetch account data if we have a propAccountId
    const { data: account } = useQuery({
        queryKey: ["account", propAccountId],
        queryFn: async () => {
            if (!propAccountId) return null;
            const response = await api.get(
                `/api/entities/accounts/${propAccountId}`
            );
            return response.data;
        },
        enabled: !!propAccountId,
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    });

    const [permissions, setPermissions] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
        new Set()
    );
    const [expandedSubcategories, setExpandedSubcategories] = useState<
        Set<string>
    >(new Set());

    // Fetch available permissions
    const { data: permissionsData } = useQuery<{
        permissions: string[];
        permissionsByCategory: Record<string, Record<string, string[]>>;
    }>({
        queryKey: ["permissions", accountId],
        queryFn: async () => {
            const response = await api.get("/permissions", {
                params: accountId ? { accountId } : undefined,
            });
            return response.data;
        },
        enabled: !!accountId,
        staleTime: 0, // Always fetch fresh data to pick up new permissions
    });

    // Fetch current role permissions
    const { data: rolePermissionsData, isLoading: isLoadingPermissions } =
        useQuery<{ permissions: string[] }>({
            queryKey: ["role-permissions", accountId, role],
            queryFn: async () => {
                // Always send accountId to ensure we get the correct account's permissions
                const response = await api.get(`/permissions/${role}`, {
                    params: { accountId: accountId },
                });
                return response.data;
            },
            enabled: !!role && !!accountId,
            staleTime: 2 * 60 * 1000, // Cache for 2 minutes
        });

    // Update permissions when role permissions are loaded
    useEffect(() => {
        if (rolePermissionsData?.permissions && permissionsData?.permissions) {
            // Filter to only include permissions that exist in the available permissions list
            // This prevents counting deprecated/removed permissions
            const availablePermissionsSet = new Set(
                permissionsData.permissions
            );
            const validPermissions = rolePermissionsData.permissions.filter(
                (perm) => availablePermissionsSet.has(perm)
            );

            // Auto-fix permissions to ensure dependencies are satisfied
            // Note: autoFixPermissions only REMOVES invalid permissions, it doesn't add any
            const fixedPermissions = autoFixPermissions(
                new Set(validPermissions)
            );

            setPermissions(fixedPermissions);
        }
    }, [rolePermissionsData, permissionsData, role]);

    // Cleanup: Remove any invalid permissions from state that don't exist in available list
    useEffect(() => {
        if (permissionsData?.permissions && permissions.size > 0) {
            const availablePermissionsSet = new Set(
                permissionsData.permissions
            );
            const invalidPermissions = Array.from(permissions).filter(
                (perm) => !availablePermissionsSet.has(perm)
            );

            if (invalidPermissions.length > 0) {
                // Remove invalid permissions from state
                setPermissions((prev) => {
                    const cleaned = new Set(prev);
                    invalidPermissions.forEach((perm) => cleaned.delete(perm));
                    return cleaned;
                });
            }
        }
    }, [permissionsData?.permissions, permissions]);

    // Group permissions by category with subcategories
    const permissionsByCategory: PermissionCategory[] = useMemo(() => {
        if (!permissionsData?.permissionsByCategory) return [];
        return Object.entries(permissionsData.permissionsByCategory).map(
            ([categoryKey, subcategories]) => {
                // Check if this is the new nested structure (object with subcategories) or old flat structure (array)
                const isNestedStructure =
                    subcategories &&
                    typeof subcategories === "object" &&
                    !Array.isArray(subcategories);

                if (!isNestedStructure) {
                    // Handle old flat structure - treat as single subcategory
                    const perms = subcategories as string[];
                    return {
                        key: categoryKey,
                        label: t(`values.category_${categoryKey}`, {
                            ns: "security_roles",
                            defaultValue: categoryKey,
                        }),
                        subcategories: [
                            {
                                key: categoryKey,
                                label: t(`values.category_${categoryKey}`, {
                                    ns: "security_roles",
                                    defaultValue: categoryKey,
                                }),
                                permissions: perms || [],
                            },
                        ],
                        permissions: perms || [],
                    };
                }

                // Handle new nested structure
                const allPermissions: string[] = [];
                const subcategoryList: PermissionSubcategory[] = Object.entries(
                    subcategories as Record<string, string[]>
                ).map(([subKey, perms]) => {
                    const permissionsArray = Array.isArray(perms) ? perms : [];
                    allPermissions.push(...permissionsArray);
                    return {
                        key: subKey,
                        label: t(`values.subcategory_${subKey}`, {
                            ns: "security_roles",
                            defaultValue: t(`values.category_${subKey}`, {
                                ns: "security_roles",
                                defaultValue: subKey,
                            }),
                        }),
                        permissions: permissionsArray,
                    };
                });

                return {
                    key: categoryKey,
                    label: t(`values.category_${categoryKey}`, {
                        ns: "security_roles",
                        defaultValue: categoryKey,
                    }),
                    subcategories: subcategoryList,
                    permissions: allPermissions,
                };
            }
        );
    }, [permissionsData, t]);

    // Filter permissions based on search query
    const filteredCategories = useMemo(() => {
        if (!searchQuery.trim()) return permissionsByCategory;

        const query = searchQuery.toLowerCase();
        return permissionsByCategory
            .map((category) => {
                // Filter subcategories
                const filteredSubcategories = category.subcategories
                    .map((subcategory) => {
                        const filteredPermissions =
                            subcategory.permissions.filter((perm) => {
                                const permLabel =
                                    getPermissionLabel(perm).toLowerCase();
                                return (
                                    permLabel.includes(query) ||
                                    perm.toLowerCase().includes(query)
                                );
                            });
                        return {
                            ...subcategory,
                            permissions: filteredPermissions,
                        };
                    })
                    .filter(
                        (subcategory) => subcategory.permissions.length > 0
                    );

                // Rebuild flattened permissions list from filtered subcategories
                const filteredPermissions = filteredSubcategories.flatMap(
                    (sub) => sub.permissions
                );

                return {
                    ...category,
                    subcategories: filteredSubcategories,
                    permissions: filteredPermissions,
                };
            })
            .filter((category) => category.permissions.length > 0);
    }, [permissionsByCategory, searchQuery, getPermissionLabel]);

    // Calculate statistics
    const nestedPermissionsSet = useMemo(
        () => collectUniquePermissions(permissionsByCategory),
        [permissionsByCategory]
    );

    const totalPermissions = useMemo(() => {
        if (nestedPermissionsSet.size > 0) {
            return nestedPermissionsSet.size;
        }
        return permissionsData?.permissions?.length ?? 0;
    }, [nestedPermissionsSet, permissionsData?.permissions]);

    const selectedCount = useMemo(() => {
        if (!permissionsData?.permissions) return 0;
        const available = new Set(permissionsData.permissions);
        return Array.from(permissions).filter(
            (perm) => available.has(perm) && nestedPermissionsSet.has(perm)
        ).length;
    }, [permissions, permissionsData?.permissions, nestedPermissionsSet]);

    // Auto-expand categories and subcategories with search matches
    useEffect(() => {
        if (searchQuery.trim() && filteredCategories.length > 0) {
            // Expand all categories that have matching permissions
            const categoryKeys = filteredCategories.map((cat) => cat.key);
            setExpandedCategories(new Set(categoryKeys));
            // Also expand all subcategories when searching
            const allSubcategoryKeys = filteredCategories.flatMap((cat) =>
                cat.subcategories.map((sub) => `${cat.key}_${sub.key}`)
            );
            setExpandedSubcategories(new Set(allSubcategoryKeys));
        }
    }, [searchQuery, filteredCategories]);

    // Handle accordion expansion
    const handleAccordionChange = useCallback((categoryKey: string) => {
        setExpandedCategories((prev) => toggleSetItem(prev, categoryKey));
    }, []);

    const handleSubcategoryChange = useCallback((subcategoryKey: string) => {
        setExpandedSubcategories((prev) => toggleSetItem(prev, subcategoryKey));
    }, []);

    // Expand all / Collapse all
    const handleExpandAll = useCallback(() => {
        if (expandedCategories.size === filteredCategories.length) {
            setExpandedCategories(new Set());
            setExpandedSubcategories(new Set());
        } else {
            setExpandedCategories(
                new Set(filteredCategories.map((cat) => cat.key))
            );
            // Also expand all subcategories
            const allSubcategoryKeys = filteredCategories.flatMap((cat) =>
                cat.subcategories.map((sub) => `${cat.key}_${sub.key}`)
            );
            setExpandedSubcategories(new Set(allSubcategoryKeys));
        }
    }, [expandedCategories, filteredCategories]);

    // Update mutation
    const updateMutation = useMutation({
        mutationFn: async (perms: string[]) => {
            const response = await api.put(`/roles/${role}`, {
                permissions: perms,
                accountId: propAccountId,
            });
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["role-permissions"] });
            queryClient.invalidateQueries({ queryKey: ["roles"] });
            // Invalidate all user-permissions queries so navigation menu updates immediately
            // This will match all queries that start with ["user-permissions"] regardless of additional parameters
            queryClient.invalidateQueries({
                queryKey: ["user-permissions"],
                refetchType: "active", // Refetch all active queries immediately
            });
            // Remove all user-permissions queries from cache to force fresh fetch
            queryClient.removeQueries({
                queryKey: ["user-permissions"],
            });
            // Also explicitly refetch to ensure permissions are updated in the current session
            queryClient.refetchQueries({
                queryKey: ["user-permissions"],
                type: "active", // Only refetch active queries
            });
            success(
                t("messages.permissions_updated", { ns: "security_roles" })
            );
            // Stay on the same page - don't navigate away
        },
        onError: (err: any) => {
            showError(
                err?.response?.data?.error ||
                t("messages.update_failed", { ns: "security_roles" })
            );
        },
    });

    const handlePermissionToggle = useCallback(
        (permission: string) => {
            // Validate that the permission exists in the available permissions list
            if (!permissionsData?.permissions?.includes(permission)) {
                showError(
                    t("messages.invalid_permission", {
                        ns: "security_roles",
                        defaultValue: "This permission is not available.",
                    })
                );
                return;
            }

            setPermissions((prev) => {
                const newSet = new Set(prev);

                if (newSet.has(permission)) {
                    // Disabling a permission: remove it and all its dependents
                    newSet.delete(permission);
                    const dependentsToDisable = getPermissionsToDisable(
                        permission,
                        prev
                    );
                    dependentsToDisable.forEach((dep) => newSet.delete(dep));
                } else {
                    // Enabling a permission: check if prerequisites are met
                    const { canEnable, missingPrerequisites } =
                        canEnablePermission(permission, newSet);

                    if (canEnable) {
                        newSet.add(permission);
                    } else {
                        // Show error message about missing prerequisites
                        const missingPrereqNames = missingPrerequisites
                            .map((prereq) =>
                                t(`fields.${prereq}`, {
                                    ns: "security_roles",
                                    defaultValue: prereq,
                                })
                            )
                            .join(", ");
                        showError(
                            t("messages.missing_prerequisites", {
                                ns: "security_roles",
                                defaultValue: `Cannot enable this permission. Required: ${missingPrereqNames}`,
                                prerequisites: missingPrereqNames,
                            })
                        );
                    }
                }

                return newSet;
            });
        },
        [t, showError, permissionsData?.permissions]
    );

    const handleCategoryToggle = useCallback(
        (categoryPermissions: string[], selectAll: boolean) => {
            // Filter to only include valid permissions that exist in the available list
            const availablePermissionsSet = permissionsData?.permissions
                ? new Set(permissionsData.permissions)
                : new Set<string>();
            const validPermissions = categoryPermissions.filter((perm) =>
                availablePermissionsSet.has(perm)
            );

            setPermissions((prev) => {
                const newSet = new Set(prev);
                if (selectAll) {
                    // Only add permissions that can be enabled (prerequisites are met) and are valid
                    validPermissions.forEach((perm) => {
                        const { canEnable } = canEnablePermission(perm, newSet);
                        if (canEnable) {
                            newSet.add(perm);
                        }
                    });
                } else {
                    // Remove permissions and their dependents
                    validPermissions.forEach((perm) => {
                        newSet.delete(perm);
                        const dependentsToDisable = getPermissionsToDisable(
                            perm,
                            prev
                        );
                        dependentsToDisable.forEach((dep) =>
                            newSet.delete(dep)
                        );
                    });
                }
                return newSet;
            });
        },
        [permissionsData?.permissions]
    );

    // Helper to check if a permission is disabled due to missing prerequisites
    const isPermissionDisabled = useCallback(
        (permission: string): { disabled: boolean; reason?: string } => {
            const { canEnable, missingPrerequisites } = canEnablePermission(
                permission,
                permissions
            );
            if (canEnable) {
                return { disabled: false };
            }
            const missingPrereqNames = missingPrerequisites
                .map((prereq) =>
                    t(`fields.${prereq}`, {
                        ns: "security_roles",
                        defaultValue: prereq,
                    })
                )
                .join(", ");
            return {
                disabled: true,
                reason: t("messages.requires_prerequisites", {
                    ns: "security_roles",
                    defaultValue: `Requires: ${missingPrereqNames}`,
                    prerequisites: missingPrereqNames,
                }),
            };
        },
        [permissions, t]
    );

    const handleSave = useCallback(() => {
        // Auto-fix permissions to ensure all dependencies are satisfied before saving
        const fixedPermissions = autoFixPermissions(permissions);
        const permissionsArray = Array.from(fixedPermissions);

        // If permissions were fixed, update the state to reflect the changes
        if (fixedPermissions.size !== permissions.size) {
            setPermissions(fixedPermissions);
            success(
                t("messages.permissions_auto_fixed", {
                    ns: "security_roles",
                    defaultValue:
                        "Some permissions were automatically adjusted to satisfy dependencies.",
                })
            );
        }

        updateMutation.mutate(permissionsArray);
    }, [permissions, updateMutation, t, success]);

    const handleBack = useCallback(() => {
        const locale = isHebrew ? "he" : "en";
        if (propAccountId) {
            router.push(
                `/${locale}/app/admin/accounts/${propAccountId}/details`
            );
        } else {
            router.push(`/${locale}/app/settings?tab=security_roles`);
        }
    }, [propAccountId, router, isHebrew]);

    const navigateToRoles = useCallback(() => {
        if (propAccountId) {
            router.push(
                `/app/admin/accounts/${propAccountId}/details?tab=security_roles`
            );
        } else {
            router.push("/app/settings?tab=security_roles");
        }
    }, [propAccountId, router]);

    const roleDisplayName = useMemo(
        () => t(`values.${role}`, { ns: "security_roles", defaultValue: role }),
        [role, t]
    );

    const allCategoriesExpanded =
        expandedCategories.size === filteredCategories.length &&
        filteredCategories.length > 0;

    const breadcrumbItems = useMemo(() => {
        const currentPage = (
            <Typography
                key="current"
                color="text.primary"
                sx={breadcrumbTextSx(isHebrew)}
            >
                {roleDisplayName}
            </Typography>
        );

        if (propAccountId && account) {
            return [
                <BreadcrumbNavLink
                    key="accounts"
                    onClick={navigateToRoles}
                    isHebrew={isHebrew}
                >
                    {t("sections.accounts_title", { ns: "accounts" })}
                </BreadcrumbNavLink>,
                <BreadcrumbNavLink
                    key="account-name"
                    onClick={navigateToRoles}
                    isHebrew={isHebrew}
                >
                    {account.name}
                </BreadcrumbNavLink>,
                <BreadcrumbNavLink
                    key="security-roles"
                    onClick={navigateToRoles}
                    isHebrew={isHebrew}
                >
                    {t("fields.tab_roles", { ns: "security_roles" }).trim()}
                </BreadcrumbNavLink>,
                currentPage,
            ];
        }

        return [
            <BreadcrumbNavLink
                key="settings"
                onClick={navigateToRoles}
                isHebrew={isHebrew}
            >
                {t("fields.title", { ns: "settings" })}
            </BreadcrumbNavLink>,
            <BreadcrumbNavLink
                key="security-roles"
                onClick={navigateToRoles}
                isHebrew={isHebrew}
            >
                {t("fields.tab_roles", { ns: "security_roles" }).trim()}
            </BreadcrumbNavLink>,
            currentPage,
        ];
    }, [
        account,
        isHebrew,
        navigateToRoles,
        propAccountId,
        roleDisplayName,
        t,
    ]);

    // Helper function to highlight search matches in text
    const highlightSearchMatch = useCallback(
        (text: string, query: string): React.ReactNode => {
            if (!query.trim()) return text;

            const lowerText = text.toLowerCase();
            const lowerQuery = query.toLowerCase();
            const parts: React.ReactNode[] = [];
            let lastIndex = 0;
            let index = lowerText.indexOf(lowerQuery, lastIndex);

            while (index !== -1) {
                // Add text before match
                if (index > lastIndex) {
                    parts.push(text.substring(lastIndex, index));
                }

                // Add highlighted match
                parts.push(
                    <Box
                        component="span"
                        key={`match-${index}`}
                        sx={{
                            bgcolor:
                                theme.palette.mode === "dark"
                                    ? "warning.dark"
                                    : "warning.light",
                            color:
                                theme.palette.mode === "dark"
                                    ? "warning.contrastText"
                                    : "warning.dark",
                            fontWeight: 700,
                            px: 0.5,
                            borderRadius: 0.5,
                            display: "inline-block",
                        }}
                    >
                        {text.substring(index, index + query.length)}
                    </Box>
                );

                lastIndex = index + query.length;
                index = lowerText.indexOf(lowerQuery, lastIndex);
            }

            // Add remaining text
            if (lastIndex < text.length) {
                parts.push(text.substring(lastIndex));
            }

            return parts.length > 0 ? <>{parts}</> : text;
        },
        [theme]
    );

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                minHeight: "100%",
                height: "100%",
                bgcolor: "background.default",
            }}
        >
            {/* Sticky header: wrapper has no transform so sticky works (layout main is scroll container) */}
            <Box
                sx={{
                    position: "sticky",
                    top: 0,
                    zIndex: 30,
                    flexShrink: 0,
                    bgcolor: "background.default",
                    px: { xs: 2, sm: 3 },
                    pt: { xs: 2, sm: 3 },
                    pb: 0,
                }}
            >
                {/* Breadcrumbs - same structure as edit email template page */}
                <Breadcrumbs sx={{ mb: theme.spacing(3) }}>
                    {(isHebrew
                        ? [...breadcrumbItems].reverse()
                        : breadcrumbItems)}
                </Breadcrumbs>

                {/* Header - same structure as edit email template page */}
                <PageHeader
                    title={`${t("actions.manage_permissions", {
                        ns: "security_roles",
                    })}: ${roleDisplayName}`}
                    description={t("actions.manage_permissions_description", {
                        ns: "security_roles",
                        defaultValue: "Configure permissions for this role",
                    })}
                    sticky={false}
                >
                    {/* Action Buttons */}
                    <Box>
                        <Stack
                            direction="row"
                            alignItems="center"
                            className="edit-action-button-group"
                        >
                            <Button
                                variant="outlined"
                                className="cancel-button"
                                onClick={handleBack}
                                disabled={updateMutation.isPending}
                            >
                                {t("actions.cancel", { ns: "common" })}
                            </Button>
                            <Button
                                variant="contained"
                                onClick={
                                    updateMutation.isPending
                                        ? undefined
                                        : handleSave
                                }
                                fullWidth={false}
                                className="save-button"
                                disabled={updateMutation.isPending}
                                sx={{
                                    "& .MuiButton-endIcon": {
                                        marginRight: isHebrew
                                            ? theme.spacing(1)
                                            : undefined,
                                        marginLeft: isHebrew
                                            ? undefined
                                            : theme.spacing(1),
                                    },
                                }}
                            >
                                {t("actions.save", { ns: "common" })}
                            </Button>
                        </Stack>
                    </Box>
                </PageHeader>
            </Box>

            {/* Scrollable content - fills remaining height so header stays fixed */}
            <Box
                sx={{
                    flex: 1,
                    minHeight: 0,
                    overflow: "auto",
                    px: { xs: 2, sm: 3 },
                    pb: { xs: 2, sm: 3 },
                }}
            >
                {
                    isLoadingPermissions ? (
                        <Box
                            sx={{
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center",
                                minHeight: 400,
                            }}
                        >
                            <CircularProgress />
                        </Box>
                    ) : (
                        <Box
                            sx={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 3,
                            }}
                        >
                            {/* Summary and Search Bar */}
                            <Paper
                                elevation={0}
                                sx={{
                                    p: 2,
                                    bgcolor: "background.paper",
                                    border: "none",
                                    boxShadow: "none",
                                }}
                            >
                                <Box
                                    sx={{
                                        display: "flex",
                                        flexDirection: { xs: "column", sm: "row" },
                                        gap: 2,
                                        alignItems: { xs: "stretch", sm: "center" },
                                        justifyContent: "space-between",
                                    }}
                                >
                                    {/* Summary Stats */}
                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 2,
                                            flexWrap: "wrap",
                                        }}
                                    >
                                        <Chip
                                            label={`${selectedCount} / ${totalPermissions} ${t("fields.permissions", { ns: "security_roles", defaultValue: "Permissions" })}`}
                                            color="primary"
                                            variant="outlined"
                                            sx={{ fontWeight: 600 }}
                                        />
                                    </Box>

                                    {/* Search and Expand Controls */}
                                    <Box
                                        sx={{
                                            display: "flex",
                                            gap: 1,
                                            alignItems: "center",
                                            flex: { xs: 1, sm: "0 0 auto" },
                                        }}
                                    >
                                        <Box
                                            sx={{
                                                width: PERMISSIONS_SEARCH_WIDTH,
                                                flexShrink: 0,
                                            }}
                                        >
                                            <PermissionsSearchField
                                                value={searchQuery}
                                                onChange={setSearchQuery}
                                                isHebrew={isHebrew}
                                            />
                                        </Box>
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            onClick={handleExpandAll}
                                            sx={(theme) =>
                                                expandAllButtonSx(theme, isHebrew)
                                            }
                                        >
                                            {allCategoriesExpanded
                                                ? t("actions.collapse_all", {
                                                    ns: "common",
                                                    defaultValue: "Collapse All",
                                                })
                                                : t("actions.expand_all", {
                                                    ns: "common",
                                                    defaultValue: "Expand All",
                                                })}
                                        </Button>
                                    </Box>
                                </Box>
                            </Paper>

                            {/* Permissions by category - Accordion Layout */}
                            <Box
                                sx={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 1.5,
                                }}
                            >
                                {filteredCategories.length === 0 ? (
                                    <Paper
                                        elevation={0}
                                        sx={{
                                            p: 4,
                                            textAlign: "center",
                                            bgcolor: "background.paper",
                                            border: "1px solid",
                                            borderColor: "divider",
                                            borderRadius: 2,
                                        }}
                                    >
                                        <Typography
                                            variant="body1"
                                            color="text.secondary"
                                        >
                                            {t("messages.no_permissions_found", {
                                                ns: "security_roles",
                                                defaultValue:
                                                    "No permissions found matching your search.",
                                            })}
                                        </Typography>
                                    </Paper>
                                ) : (
                                    filteredCategories.map((category) => {
                                        const categoryPermissions =
                                            category.permissions;
                                        const selectedInCategory =
                                            categoryPermissions.filter((perm) =>
                                                permissions.has(perm)
                                            ).length;
                                        const allSelected =
                                            categoryPermissions.length > 0 &&
                                            categoryPermissions.every((perm) =>
                                                permissions.has(perm)
                                            );
                                        const isExpanded = expandedCategories.has(
                                            category.key
                                        );

                                        return (
                                            <Accordion
                                                key={category.key}
                                                expanded={isExpanded}
                                                disableGutters
                                                onChange={() =>
                                                    handleAccordionChange(
                                                        category.key
                                                    )
                                                }
                                                elevation={0}
                                                sx={{
                                                    border: "1px solid",
                                                    borderColor: "divider",
                                                    borderRadius: pillRadiusPx,
                                                    overflow: "hidden",
                                                    "&:before": { display: "none" },
                                                    "&:first-of-type, &:last-of-type, &:not(:first-of-type)":
                                                    {
                                                        borderRadius:
                                                            pillRadiusPx,
                                                    },
                                                    "&.Mui-expanded": {
                                                        margin: 0,
                                                    },
                                                }}
                                            >
                                                <AccordionSummary
                                                    expandIcon={<ExpandMoreIcon />}
                                                    sx={{
                                                        bgcolor: allSelected
                                                            ? "action.selected"
                                                            : selectedInCategory > 0
                                                                ? "action.hover"
                                                                : "background.paper",
                                                        borderTopLeftRadius: pillRadiusPx,
                                                        borderTopRightRadius: pillRadiusPx,
                                                        borderBottomLeftRadius: isExpanded
                                                            ? 0
                                                            : pillRadiusPx,
                                                        borderBottomRightRadius: isExpanded
                                                            ? 0
                                                            : pillRadiusPx,
                                                        px: 2,
                                                        py: 0.25,
                                                        minHeight: 36,
                                                        "& .MuiAccordionSummary-content":
                                                            {
                                                                my: 0,
                                                                "&.Mui-expanded": {
                                                                    my: 0,
                                                                },
                                                            },
                                                        "&.Mui-expanded": {
                                                            minHeight: 36,
                                                            borderTopLeftRadius:
                                                                pillRadiusPx,
                                                            borderTopRightRadius:
                                                                pillRadiusPx,
                                                            borderBottomLeftRadius: 0,
                                                            borderBottomRightRadius: 0,
                                                        },
                                                        "&:hover": {
                                                            bgcolor: "action.hover",
                                                        },
                                                    }}
                                                >
                                                    <Box
                                                        sx={{
                                                            display: "flex",
                                                            alignItems: "center",
                                                            justifyContent:
                                                                "space-between",
                                                            width: "100%",
                                                            pr: isHebrew ? 0 : 2,
                                                            pl: isHebrew ? 2 : 0,
                                                        }}
                                                    >
                                                        <Box
                                                            sx={{
                                                                display: "flex",
                                                                alignItems:
                                                                    "center",
                                                                gap: 1.5,
                                                            }}
                                                        >
                                                            <SecurityIcon
                                                                sx={{
                                                                    color: allSelected
                                                                        ? "primary.main"
                                                                        : selectedInCategory >
                                                                            0
                                                                            ? "primary.light"
                                                                            : "text.secondary",
                                                                    fontSize: 18,
                                                                }}
                                                            />
                                                            <Typography
                                                                variant="subtitle1"
                                                                sx={{
                                                                    fontWeight: 600,
                                                                    fontSize:
                                                                        "0.875rem",
                                                                    lineHeight: 1.25,
                                                                }}
                                                            >
                                                                {highlightSearchMatch(
                                                                    category.label,
                                                                    searchQuery
                                                                )}
                                                            </Typography>
                                                            <Chip
                                                                size="small"
                                                                label={`${selectedInCategory}/${categoryPermissions.length}`}
                                                                color={
                                                                    allSelected
                                                                        ? "primary"
                                                                        : "default"
                                                                }
                                                                variant={
                                                                    allSelected
                                                                        ? "filled"
                                                                        : "outlined"
                                                                }
                                                                sx={{
                                                                    fontSize:
                                                                        "0.7rem",
                                                                    height: 20,
                                                                }}
                                                            />
                                                        </Box>
                                                        <Box
                                                            component="div"
                                                            onClick={(e) =>
                                                                e.stopPropagation()
                                                            }
                                                        >
                                                            <FormControlLabel
                                                                control={
                                                                    <Switch
                                                                        checked={
                                                                            allSelected
                                                                        }
                                                                        onChange={() =>
                                                                            handleCategoryToggle(
                                                                                categoryPermissions,
                                                                                !allSelected
                                                                            )
                                                                        }
                                                                        disabled={
                                                                            role ===
                                                                            "System_Administrator" &&
                                                                            category.key ===
                                                                            "user_access_management"
                                                                        }
                                                                        color="primary"
                                                                        {...(isHebrew && {
                                                                            "data-rtl": true,
                                                                        })}
                                                                    />
                                                                }
                                                                label={
                                                                    <Typography
                                                                        variant="body2"
                                                                        sx={{
                                                                            fontSize: {
                                                                                xs: "0.75rem",
                                                                                sm: "0.8rem",
                                                                                md: "0.875rem",
                                                                            },
                                                                        }}
                                                                    >
                                                                        {t(
                                                                            "actions.select_all",
                                                                            {
                                                                                ns: "security_roles",
                                                                            }
                                                                        )}
                                                                    </Typography>
                                                                }
                                                                labelPlacement="end"
                                                                sx={{
                                                                    m: 0,
                                                                    gap: theme.spacing(1.5),
                                                                    direction: isHebrew
                                                                        ? "rtl"
                                                                        : "ltr",
                                                                    justifyContent: "flex-start",
                                                                    "& .MuiFormControlLabel-label":
                                                                    {
                                                                        marginLeft: 0,
                                                                        marginRight: 0,
                                                                    },
                                                                }}
                                                            />
                                                        </Box>
                                                    </Box>
                                                </AccordionSummary>
                                                <AccordionDetails
                                                    sx={{
                                                        p: 0,
                                                        bgcolor: "background.paper",
                                                        borderBottomLeftRadius: pillRadiusPx,
                                                        borderBottomRightRadius: pillRadiusPx,
                                                        "&.MuiAccordionDetails-root": {
                                                            padding: 0,
                                                            paddingLeft: 0,
                                                            paddingRight: 0,
                                                        },
                                                    }}
                                                >
                                                    <Box
                                                        sx={{
                                                            p: 0,
                                                            direction: isHebrew
                                                                ? "rtl"
                                                                : "ltr",
                                                            bgcolor:
                                                                "background.default",
                                                        }}
                                                    >
                                                        {category.subcategories.map(
                                                            (subcategory) => {
                                                                const subcategoryKey = `${category.key}_${subcategory.key}`;
                                                                // Ensure permissions is always an array
                                                                const subcategoryPermissions =
                                                                    Array.isArray(
                                                                        subcategory.permissions
                                                                    )
                                                                        ? subcategory.permissions
                                                                        : [];
                                                                const selectedInSubcategory =
                                                                    subcategoryPermissions.filter(
                                                                        (perm) =>
                                                                            permissions.has(
                                                                                perm
                                                                            )
                                                                    ).length;
                                                                const allSubcategorySelected =
                                                                    subcategoryPermissions.length >
                                                                    0 &&
                                                                    subcategoryPermissions.every(
                                                                        (perm) =>
                                                                            permissions.has(
                                                                                perm
                                                                            )
                                                                    );
                                                                // Auto-expand subcategories when category is expanded and no search query
                                                                const isCategoryExpanded =
                                                                    expandedCategories.has(
                                                                        category.key
                                                                    );
                                                                const isSubcategoryExpanded =
                                                                    expandedSubcategories.has(
                                                                        subcategoryKey
                                                                    ) ||
                                                                    (isCategoryExpanded &&
                                                                        searchQuery.trim() ===
                                                                        "") ||
                                                                    searchQuery.trim() !==
                                                                    "";

                                                                return (
                                                                    <Box
                                                                        key={
                                                                            subcategory.key
                                                                        }
                                                                    >
                                                                        {/* Subcategory Header */}
                                                                        <Box
                                                                            sx={{
                                                                                display:
                                                                                    "flex",
                                                                                alignItems:
                                                                                    "center",
                                                                                justifyContent:
                                                                                    "space-between",
                                                                                px: 2.5,
                                                                                py: 1.5,
                                                                                cursor: "pointer",
                                                                            }}
                                                                            onClick={() =>
                                                                                handleSubcategoryChange(
                                                                                    subcategoryKey
                                                                                )
                                                                            }
                                                                        >
                                                                            <Box
                                                                                sx={{
                                                                                    display:
                                                                                        "flex",
                                                                                    alignItems:
                                                                                        "center",
                                                                                    gap: 1.5,
                                                                                }}
                                                                            >
                                                                                <Typography
                                                                                    variant="subtitle2"
                                                                                    sx={{
                                                                                        fontWeight: 600,
                                                                                        fontSize:
                                                                                            "0.875rem",
                                                                                        color: "primary.main",
                                                                                    }}
                                                                                >
                                                                                    {highlightSearchMatch(
                                                                                        subcategory.label,
                                                                                        searchQuery
                                                                                    )}
                                                                                </Typography>
                                                                                <Chip
                                                                                    label={`${selectedInSubcategory}/${subcategoryPermissions.length}`}
                                                                                    color={
                                                                                        allSubcategorySelected
                                                                                            ? "primary"
                                                                                            : "default"
                                                                                    }
                                                                                    variant={
                                                                                        allSubcategorySelected
                                                                                            ? "filled"
                                                                                            : "outlined"
                                                                                    }
                                                                                    size="small"
                                                                                    sx={{
                                                                                        fontSize:
                                                                                            "0.7rem",
                                                                                        height: "20px",
                                                                                    }}
                                                                                />
                                                                            </Box>
                                                                        </Box>

                                                                        {/* Subcategory Permissions */}
                                                                        {isSubcategoryExpanded && (
                                                                            <Box
                                                                                sx={{
                                                                                    ...SUBCATEGORY_PERMISSIONS_GRID_SX,
                                                                                    paddingBlock: theme.spacing(2.5),
                                                                                    paddingInlineStart: theme.spacing(4),
                                                                                    paddingInlineEnd: theme.spacing(2.5),
                                                                                }}
                                                                            >
                                                                                {subcategoryPermissions.map(
                                                                                    (
                                                                                        permission
                                                                                    ) => {
                                                                                        const {
                                                                                            disabled,
                                                                                            reason,
                                                                                        } =
                                                                                            isPermissionDisabled(
                                                                                                permission
                                                                                            );
                                                                                        const isLockedForSystemAdmin =
                                                                                            role ===
                                                                                            "System_Administrator" &&
                                                                                            category.key ===
                                                                                            "user_access_management";
                                                                                        const isChecked =
                                                                                            permissions.has(
                                                                                                permission
                                                                                            );
                                                                                        const switchDisabled =
                                                                                            disabled ||
                                                                                            isLockedForSystemAdmin;
                                                                                        const tooltipTitle =
                                                                                            switchDisabled
                                                                                                ? isLockedForSystemAdmin
                                                                                                    ? t(
                                                                                                        "messages.user_access_management_locked",
                                                                                                        {
                                                                                                            ns: "security_roles",
                                                                                                            defaultValue:
                                                                                                                "User & Access Management permissions are locked for System Administrator",
                                                                                                        }
                                                                                                    )
                                                                                                    : reason ||
                                                                                                    ""
                                                                                                : "";

                                                                                        return (
                                                                                            <Tooltip
                                                                                                key={
                                                                                                    permission
                                                                                                }
                                                                                                title={
                                                                                                    tooltipTitle
                                                                                                }
                                                                                                arrow
                                                                                                placement="bottom"
                                                                                            >
                                                                                                <FormControlLabel
                                                                                                    control={
                                                                                                        <Switch
                                                                                                            checked={
                                                                                                                isChecked
                                                                                                            }
                                                                                                            onChange={() =>
                                                                                                                handlePermissionToggle(
                                                                                                                    permission
                                                                                                                )
                                                                                                            }
                                                                                                            disabled={
                                                                                                                switchDisabled
                                                                                                            }
                                                                                                            color="primary"
                                                                                                            {...(isHebrew && {
                                                                                                                "data-rtl": true,
                                                                                                            })}
                                                                                                        />
                                                                                                    }
                                                                                                    label={
                                                                                                        <Typography
                                                                                                            variant="body2"
                                                                                                            sx={{
                                                                                                                fontWeight:
                                                                                                                    isChecked
                                                                                                                        ? 500
                                                                                                                        : 400,
                                                                                                                color: switchDisabled
                                                                                                                    ? "text.disabled"
                                                                                                                    : isChecked
                                                                                                                        ? "text.primary"
                                                                                                                        : "text.secondary",
                                                                                                            }}
                                                                                                        >
                                                                                                            {highlightSearchMatch(
                                                                                                                getPermissionLabel(
                                                                                                                    permission
                                                                                                                ),
                                                                                                                searchQuery
                                                                                                            )}
                                                                                                        </Typography>
                                                                                                    }
                                                                                                    labelPlacement="end"
                                                                                                    sx={permissionFormControlSx(
                                                                                                        theme,
                                                                                                        isHebrew,
                                                                                                        switchDisabled
                                                                                                    )}
                                                                                                />
                                                                                            </Tooltip>
                                                                                        );
                                                                                    }
                                                                                )}
                                                                            </Box>
                                                                        )}
                                                                    </Box>
                                                                );
                                                            }
                                                        )}
                                                    </Box>
                                                </AccordionDetails>
                                            </Accordion>
                                        );
                                    })
                                )}
                            </Box>
                        </Box>
                    )
                }
            </Box>
        </Box>
    );
}
