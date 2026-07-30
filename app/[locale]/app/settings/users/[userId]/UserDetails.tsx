"use client";

import {
    InfoOutlined as InfoOutlinedIcon,
    LocationOn as LocationIcon,
    Lock as LockIcon,
    Person as PersonIcon
} from "@mui/icons-material";
import {
    Alert,
    Autocomplete,
    Backdrop,
    Box,
    Breadcrumbs,
    Button,
    Card,
    CardContent,
    CircularProgress,
    Fade,
    FormControlLabel,
    IconButton,
    InputAdornment,
    Link,
    Stack,
    Switch,
    TextField,
    Tooltip,
    Typography,
    useTheme,
} from "@mui/material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import api, { apiFetch } from "@/app/api";
import PageHeader from "@/components/PageHeader";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import { getCountryTimezone } from "@/utils/datetimeOperations";
import { validateEmail } from "@/utils/emailValidation";
import { TimeZoneLabels } from "@/utils/timezones";

import ChangePasswordModal from "./components/ChangePasswordModal";

interface UserFormData {
    id?: string;
    first_name: string;
    last_name: string;
    username: string;
    email: string;
    mobile: string;
    role: string;
    status: "Active" | "Inactive";
    language:
    | "English"
    | "Hebrew"
    | "German"
    | "Spanish"
    | "French"
    | "Italian"
    | "Portuguese";
    time_zone: string;
    locale: string;
    freeze?: boolean;
    failed_login_attempts?: number;
    business_unit_id?: number | null;
}

interface UserDetailsProps {
    userId: string;
}

const UserDetails: React.FC<UserDetailsProps> = ({ userId }) => {
    const { t, i18n } = useTranslation(["users", "common"]);
    const isHebrewUser = i18n.language === "he";

    const theme = useTheme();
    const queryClient = useQueryClient();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { data: session, update: updateSession } = useSession();
    const { success, error: showError } = useToast();

    const isNewUser = userId === "new";
    // Compare userId (string) with session.user.id (number or string) using loose equality or conversion
    const isOwnProfile =
        session?.user?.id != null && String(session.user.id) === String(userId);
    // View-as mode: admin is impersonating another user
    const isViewAsMode = !!session?.user?.view_as_user_id;
    // Never allow editing when in view-as mode
    const [isEditing, setIsEditing] = useState(
        !isViewAsMode && (isNewUser || isOwnProfile)
    );
    const [isSaving, setIsSaving] = useState(false);
    const firstNameInputRef = useRef<HTMLInputElement>(null);
    const headerRef = useRef<HTMLDivElement>(null);
    const saveInFlightRef = useRef(false);

    const accountIdFromParams = searchParams?.get("accountId") ?? undefined;

    const [editedUser, setEditedUser] = useState<UserFormData>({
        first_name: "",
        last_name: "",
        username: "",
        email: "",
        mobile: "",
        role: "",
        status: "Active",
        language: "English",
        time_zone: "",
        locale: "en-US",
        business_unit_id: null,
    });
    const [validationErrors, setValidationErrors] = useState<
        Record<string, string>
    >({});

    const [isCheckingUsername, setIsCheckingUsername] = useState(false);
    const [usernameExists, setUsernameExists] = useState(false);

    // Password change state
    const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);

    // Clear archaser_admin role if user has archaser_admin role but customer ID is not 10013
    useEffect(() => {
        const effectiveAccountId = accountIdFromParams
            ? parseInt(accountIdFromParams, 10)
            : session?.user?.account_id;
        if (
            effectiveAccountId !== 10013 &&
            editedUser.role === "archaser_admin"
        ) {
            setEditedUser((prev) => ({ ...prev, role: "" }));
        }
    }, [accountIdFromParams, session?.user?.account_id, editedUser.role]);

    // Fetch user data if editing existing user
    const { data: user } = useQuery({
        queryKey: ["user", userId],
        queryFn: async () => {
            if (isNewUser) return null;
            const response = await apiFetch(`/api/entities/users/${userId.toString()}`
            );
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error("User not found");
                }
                throw new Error("Failed to fetch user");
            }
            return response.json();
        },
        enabled: !isNewUser,
        retry: 3,
    });

    // Determine account ID for fetching business units
    // Priority: user's account_id (for existing users) > accountIdFromParams > session account_id
    const effectiveAccountId = user?.account_id
        ? user.account_id
        : accountIdFromParams
            ? parseInt(accountIdFromParams, 10)
            : session?.user?.account_id || 0;

    // Fetch account data to get default regional settings
    const { data: account } = useQuery({
        queryKey: ["account", effectiveAccountId],
        queryFn: async () => {
            if (!effectiveAccountId || effectiveAccountId === 0) return null;
            const response = await apiFetch(`/api/entities/accounts/${effectiveAccountId}`
            );
            if (!response.ok) {
                throw new Error("Failed to fetch account");
            }
            return response.json();
        },
        enabled: effectiveAccountId > 0,
        retry: 3,
    });

    // Fetch user permissions
    const { data: userPermissionsData } = useQuery<{ permissions: string[] }>({
        queryKey: [
            "user-permissions",
            session?.user?.id,
            session?.user?.role,
            effectiveAccountId,
        ],
        queryFn: async () => {
            const response = await api.get("/api/permissions/me");
            return response.data;
        },
        enabled: !!session?.user,
        staleTime: 2 * 60 * 1000, // Cache for 2 minutes
    });

    // Fetch roles for the account
    const { data: rolesData } = useQuery<{
        roles: Array<{ role: string; permissionCount: number }>;
    }>({
        queryKey: ["roles", effectiveAccountId],
        queryFn: async () => {
            const response = await api.get("/roles", {
                params: { accountId: effectiveAccountId },
            });
            return response.data;
        },
        enabled: effectiveAccountId > 0,
        staleTime: 2 * 60 * 1000, // Cache for 2 minutes
    });

    const userPermissions = userPermissionsData?.permissions || [];
    const hasManageUsersPermission = userPermissions.includes("manage_users");

    const isSystemOrArchaserAdmin = useMemo(() => {
        const role = session?.user?.role;
        const accountId = session?.user?.account_id;
        return (
            accountId === 10013 ||
            role === "archaser_admin" ||
            role === "System_Administrator" ||
            role === "ARchaser Admin" ||
            role === "System Administrator"
        );
    }, [session?.user?.role, session?.user?.account_id]);

    // Fetch business units for dropdown - fetch all (not just active) when editing existing user
    const { data: businessUnitsData } = useQuery({
        queryKey: [
            "business-units",
            effectiveAccountId,
            isNewUser ? "active" : "all",
        ],
        queryFn: async () => {
            if (!effectiveAccountId) return [];
            // For existing users, fetch paginated list to get all BUs (active and inactive)
            // For new users, fetch only active ones
            const url = isNewUser
                ? `/api/entities/accounts/${effectiveAccountId}/business-units`
                : `/api/entities/accounts/${effectiveAccountId}/business-units?page=1&limit=1000`;
            const response = await apiFetch(url);
            if (!response.ok) {
                throw new Error("Failed to fetch business units");
            }
            const data = await response.json();
            // Handle both array response and wrapped response
            if (Array.isArray(data)) {
                return data;
            } else if (Array.isArray(data?.data)) {
                return data.data;
            }
            return [];
        },
        enabled: !!effectiveAccountId,
    });

    const businessUnits = useMemo(() => {
        return Array.isArray(businessUnitsData) ? businessUnitsData : [];
    }, [businessUnitsData]);

    // Extract role names from the API response, filtering based on business unit
    const availableRoles = useMemo(() => {
        if (!rolesData?.roles) return [];

        // Get the selected business unit
        const selectedBU = editedUser.business_unit_id
            ? businessUnits.find((bu) => bu.id === editedUser.business_unit_id)
            : null;

        // Filter roles based on business unit
        return rolesData.roles
            .map((role) => role.role)
            .filter((role) => {
                // Hide System_Administrator if business unit is not primary
                if (role === "System_Administrator") {
                    // Only show if the selected BU is primary
                    return selectedBU?.is_primary === true;
                }
                return true;
            });
    }, [rolesData, editedUser.business_unit_id, businessUnits]);

    // Auto-select business unit when creating a new user and there's only one BU (the primary BU)
    useEffect(() => {
        if (
            isNewUser &&
            businessUnits.length === 1 &&
            !editedUser.business_unit_id
        ) {
            // Set the primary business unit as default
            const primaryBU = businessUnits[0];
            setEditedUser((prev) => ({
                ...prev,
                business_unit_id: primaryBU.id,
            }));
        }
    }, [isNewUser, businessUnits, editedUser.business_unit_id]);

    // Set default regional values from account when creating a new user
    useEffect(() => {
        if (isNewUser && account) {
            setEditedUser((prev) => {
                const updates: Partial<UserFormData> = {};

                // Set language from account's default_language if still at initial default
                // Initial default is "English", so only update if it's still "English" (not manually changed)
                if (prev.language === "English" && account.default_language) {
                    updates.language = account.default_language;
                }

                // Set locale from account's locale if still at initial default
                // Initial default is "en-US", so only update if it's still "en-US" (not manually changed)
                if (prev.locale === "en-US" && account.locale) {
                    updates.locale = account.locale;
                }

                // Set time_zone from account's country if still empty (initial default)
                if (!prev.time_zone) {
                    let timezone = "Asia/Jerusalem"; // Fallback default

                    // Use account's country to determine timezone
                    if (account.Country?.iso2) {
                        const countryIso2 = account.Country.iso2;
                        const stateIso2 = account.State?.iso2;
                        const countryTimezone = getCountryTimezone(
                            countryIso2,
                            stateIso2
                        );

                        // Only use the country timezone if it's valid (not UTC fallback)
                        // UTC is returned when country lookup fails, so we keep the default
                        if (countryTimezone && countryTimezone !== "UTC") {
                            timezone = countryTimezone;
                        }
                    }

                    updates.time_zone = timezone;
                }

                // Only update if there are changes
                if (Object.keys(updates).length > 0) {
                    return { ...prev, ...updates };
                }
                return prev;
            });
        }
    }, [isNewUser, account]);

    useEffect(() => {
        // Clear any stale language change flag on initial load
        const isLanguageChangeInProgress =
            sessionStorage.getItem("languageChangeInProgress") === "true";
        if (isLanguageChangeInProgress && !user) {
            // If we have a flag but no user data yet, it might be stale
            sessionStorage.removeItem("languageChangeInProgress");
        }

        if (user && !isNewUser) {
            // Check if we're in the middle of a language change to prevent form reset
            const isLanguageChangeInProgress =
                sessionStorage.getItem("languageChangeInProgress") === "true";

            // Only prevent form reset if language change is in progress
            // Allow form reset on initial load or when not in language change
            if (!isLanguageChangeInProgress) {
                setEditedUser({
                    id: user.id,
                    first_name: user.first_name || "",
                    last_name: user.last_name || "",
                    username: user.username || "",
                    email: user.email || "",
                    mobile: user.mobile || "",
                    role: user.role || "",
                    status: user.status || "Active",
                    language: user.language || "English",
                    time_zone: user.time_zone || "",
                    locale: user.locale || "en-US",
                    freeze: user.freeze || false,
                    failed_login_attempts: user.failed_login_attempts || 0,
                    business_unit_id: user.business_unit_id || null,
                });
            }
        }
    }, [user, isNewUser]);

    // Focus on first name field when in editing mode
    useEffect(() => {
        if (isEditing && firstNameInputRef.current) {
            let timer: NodeJS.Timeout | null = null;

            // Use requestAnimationFrame for better timing and to avoid browser extension conflicts
            const focusField = () => {
                try {
                    const input = firstNameInputRef.current;
                    if (
                        input &&
                        !input.disabled &&
                        input.offsetParent !== null
                    ) {
                        // Check if field is visible and enabled before focusing
                        input.focus({ preventScroll: true });
                    }
                } catch {
                    // Silently handle any focus errors (e.g., from browser extensions)
                }
            };

            // Use requestAnimationFrame for smoother timing
            const rafId = requestAnimationFrame(() => {
                timer = setTimeout(focusField, 50);
            });

            return () => {
                cancelAnimationFrame(rafId);
                if (timer) {
                    clearTimeout(timer);
                }
            };
        }
    }, [isEditing]);

    const validateFields = (): Record<string, string> => {
        const newErrors: Record<string, string> = {};

        if (!editedUser.first_name.trim()) {
            newErrors.first_name = t("validation.required", { ns: "common" });
        }

        if (!editedUser.last_name.trim()) {
            newErrors.last_name = t("validation.required", { ns: "common" });
        }

        // Validate email
        const emailValidation = validateEmail(editedUser.email, t);
        if (!emailValidation.isValid) {
            newErrors.email =
                emailValidation.message ||
                t("validation.invalid_email", { ns: "common" });
        }

        if (!editedUser.username.trim()) {
            newErrors.username = t("validation.required", { ns: "common" });
        } else if (usernameExists) {
            newErrors.username = t(
                "messages.validation_username_already_exists",
                { ns: "users" }
            );
        }

        if (!editedUser.role) {
            newErrors.role = t("validation.required", { ns: "common" });
        }

        if (!editedUser.time_zone?.trim()) {
            newErrors.time_zone = t("validation.required", { ns: "common" });
        }

        if (!editedUser.locale) {
            newErrors.locale = t("validation.required", { ns: "common" });
        }

        if (!editedUser.business_unit_id) {
            newErrors.business_unit_id = t("validation.required", {
                ns: "common",
            });
        }

        // Validate System_Administrator must be assigned to primary business unit
        if (
            editedUser.role === "System_Administrator" &&
            editedUser.business_unit_id
        ) {
            const selectedBU = businessUnits.find(
                (bu) => bu.id === editedUser.business_unit_id
            );
            if (selectedBU && !selectedBU.is_primary) {
                newErrors.business_unit_id = t(
                    "validation.system_administrator_primary_bu_required",
                    { ns: "users" }
                );
            }
        }

        return newErrors;
    };



    const checkUsernameExists = async (username: string) => {
        if (!username) return;

        // Skip check if it's the current username of the user being edited
        if (!isNewUser && user?.username && username.toLowerCase() === user.username.toLowerCase()) {
            setUsernameExists(false);
            setValidationErrors((prev) => {
                const newErrors = { ...prev };
                delete newErrors.username;
                return newErrors;
            });
            return;
        }

        setIsCheckingUsername(true);
        try {
            const excludeParam = !isNewUser ? `&excludeUserId=${user?.id}` : "";
            const response = await apiFetch(`/api/entities/users/check-username?username=${encodeURIComponent(username)}${excludeParam}`
            );
            if (response.ok) {
                const data = await response.json();

                if (!data.available) {
                    setUsernameExists(true);
                    setValidationErrors((prev) => ({
                        ...prev,
                        username: t("messages.validation_username_already_exists", {
                            ns: "users",
                        }),
                    }));
                } else {
                    setUsernameExists(false);
                    setValidationErrors((prev) => {
                        const newErrors = { ...prev };
                        delete newErrors.username;
                        return newErrors;
                    });
                }
            }
        } catch (error) {
            console.error("Error checking username:", error);
        } finally {
            setIsCheckingUsername(false);
        }
    };

    const getUsersListPath = useCallback(
        (targetAccountId: number) => {
            const locale = i18n.language === "he" ? "he" : "en";
            if (session?.user?.account_id === 10013) {
                return `/${locale}/app/admin/accounts/${targetAccountId}/details?tab=users`;
            }
            return `/${locale}/app/settings?tab=users`;
        },
        [i18n.language, session?.user?.account_id]
    );

    const redirectToUsersList = useCallback(
        (targetAccountId: number) => {
            saveInFlightRef.current = true;
            router.push(getUsersListPath(targetAccountId));
        },
        [getUsersListPath, router]
    );

    const handleApiSaveError = useCallback(
        (errorMessage: string, responseData?: { errorCode?: string; message?: string }) => {
            if (errorMessage.includes("email already exists")) {
                setValidationErrors({
                    email: t("messages.validation_email_already_exists", {
                        ns: "users",
                    }),
                });
                showError(
                    t("messages.toast_email_already_exists", { ns: "users" })
                );
                return;
            }

            if (
                errorMessage.includes("username already exists") ||
                errorMessage.includes("username is already taken") ||
                errorMessage.includes("This username is already taken")
            ) {
                setValidationErrors({
                    username: t("messages.validation_username_already_exists", {
                        ns: "users",
                    }),
                });
                setUsernameExists(true);
                showError(
                    t("messages.validation_username_already_exists", {
                        ns: "users",
                    })
                );
                return;
            }

            if (
                responseData?.errorCode === "LAST_SYSTEM_ADMINISTRATOR" ||
                errorMessage.includes(
                    "Cannot remove the last System Administrator"
                ) ||
                errorMessage.includes(
                    "must have at least one active System Administrator"
                )
            ) {
                showError(
                    t("messages.cannot_remove_last_system_administrator", {
                        ns: "users",
                    }),
                    { duration: null }
                );
                return;
            }

            if (
                errorMessage.includes(
                    "System Administrator must be assigned to a primary business unit"
                )
            ) {
                setValidationErrors((prev) => ({
                    ...prev,
                    business_unit_id: t(
                        "validation.system_administrator_primary_bu_required",
                        { ns: "users" }
                    ),
                }));
                showError(
                    t("validation.system_administrator_primary_bu_required", {
                        ns: "users",
                    })
                );
                return;
            }

            if (errorMessage.includes("Business unit is required")) {
                setValidationErrors((prev) => ({
                    ...prev,
                    business_unit_id: t("validation.required", {
                        ns: "common",
                    }),
                }));
                showError(errorMessage);
                return;
            }

            if (errorMessage.includes("Invalid timezone")) {
                setValidationErrors((prev) => ({
                    ...prev,
                    time_zone:
                        responseData?.message ||
                        t("validation.required", { ns: "common" }),
                }));
                showError(responseData?.message || errorMessage);
                return;
            }

            showError(errorMessage);
        },
        [showError, t]
    );

    const handleSave = async () => {
        if (isSaving || saveInFlightRef.current) {
            return;
        }

        // Prevent users from deactivating themselves
        if (isOwnProfile && editedUser.status === "Inactive") {
            showError(t("messages.cannot_deactivate_self", { ns: "users" }));
            return;
        }

        const fieldErrors = validateFields();
        if (Object.keys(fieldErrors).length > 0) {
            setValidationErrors(fieldErrors);
            showError(t("messages.toast_validation_errors", { ns: "users" }));
            return;
        }

        const effectiveAccountId = accountIdFromParams
            ? parseInt(accountIdFromParams, 10)
            : session?.user?.account_id;

        if (!effectiveAccountId) {
            showError(t("messages.toast_no_account_id", { ns: "users" }));
            return;
        }

        const targetAccountId = accountIdFromParams
            ? parseInt(accountIdFromParams, 10)
            : effectiveAccountId;

        setIsSaving(true);
        try {
            const isSameAccount =
                user?.account_id === session?.user?.account_id;
            // Use permission-based access only
            // User can freeze/unfreeze if they have manage_users permission in same account
            const canFreezeUnfreeze = hasManageUsersPermission && isSameAccount;

            // Check if we're removing the last System Administrator from an account
            if (!isNewUser && user) {
                const wasSystemAdmin = user.role === "System_Administrator";
                const willBeSystemAdmin =
                    editedUser.role === "System_Administrator";

                if (wasSystemAdmin && !willBeSystemAdmin) {
                    // Check if this is the last System Administrator for the account
                    try {
                        const checkResponse = await apiFetch(`/api/entities/users/system-administrator-check?accountId=${effectiveAccountId}&excludeUserId=${user.id}`
                        );
                        if (checkResponse.ok) {
                            const checkData = await checkResponse.json();
                            if (!checkData.hasOtherSystemAdministrator) {
                                showError(
                                    t(
                                        "messages.cannot_remove_last_system_administrator",
                                        { ns: "users" }
                                    )
                                );
                                return;
                            }
                        }
                    } catch (error) {
                        // If check fails, proceed with save (server will validate)
                        console.error(
                            "Failed to check System Administrator count:",
                            error
                        );
                    }
                }
            }
            const payload: any = {
                ...editedUser,
                name: `${editedUser.first_name} ${editedUser.last_name}`.trim(),
                account_id: effectiveAccountId,
            };
            // Only include freeze field if user can freeze/unfreeze (admin or System Administrator in same account)
            // API will also check this, but we remove it here to avoid sending unnecessary data
            // Important: Explicitly include freeze field when canFreezeUnfreeze is true, even if it's false
            if (!canFreezeUnfreeze) {
                delete payload.freeze;
            } else if (canFreezeUnfreeze && editedUser.freeze !== undefined) {
                // Explicitly set freeze to ensure it's included in the payload (even if false)
                payload.freeze = editedUser.freeze;
            }

            const url = editedUser.id
                ? `/api/entities/users/${editedUser.id}`
                : `/api/entities/users`;
            const method = editedUser.id ? "PUT" : "POST";

            const response = await apiFetch(url, {
                method,
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify(payload),
            });

            const responseData = await response.json();

            if (!response.ok) {
                const errorMessage =
                    responseData?.error ||
                    t("messages.toast_failed_to_save_user", { ns: "users" });
                handleApiSaveError(errorMessage, responseData);
                return;
            }

            if (responseData.sessionUpdateRequired) {
                const updateData: any = {};
                if (responseData.newLocale)
                    updateData.locale = responseData.newLocale;
                if (responseData.newLanguage)
                    updateData.language = responseData.newLanguage;
                if (responseData.newName)
                    updateData.name = responseData.newName;
                if (responseData.newTimezone)
                    updateData.timezone = responseData.newTimezone;

                if (Object.keys(updateData).length > 0) {
                    // Update the session
                    await updateSession(updateData);

                    // Show success message
                    success(
                        t("messages.toast_user_saved_success", { ns: "users" })
                    );

                    // Handle language change - simple redirect
                    if (responseData.newLanguage) {
                        // Set flag to prevent form reset during redirect
                        sessionStorage.setItem(
                            "languageChangeInProgress",
                            "true"
                        );
                        setIsEditing(false);

                        // Immediate redirect - let the page reload handle everything
                        saveInFlightRef.current = true;
                        const newLocale =
                            responseData.newLanguage === "Hebrew" ? "he" : "en";
                        const currentPath = window.location.pathname;
                        const newPath = currentPath.replace(
                            /^\/[a-z]{2}/,
                            `/${newLocale}`
                        );

                        window.location.href = newPath;
                        return;
                    }
                }

                // If session update was required but no language change, continue with normal flow
                await queryClient.invalidateQueries({ queryKey: ["users"] });
                // Also invalidate the virtual scroll user list query
                await queryClient.invalidateQueries({
                    queryKey: ["users-virtual"],
                });

                // Redirect after session update (for new users or when session was updated)
                if (isNewUser || !editedUser.id) {
                    redirectToUsersList(targetAccountId);
                } else {
                    // For existing users, redirect back
                    if (window.history.length > 1) {
                        window.history.back();
                    } else {
                        redirectToUsersList(targetAccountId);
                    }
                }
                return;
            }

            success(t("messages.toast_user_saved_success", { ns: "users" }));

            // Invalidate all user-related queries
            await queryClient.invalidateQueries({ queryKey: ["users"] });
            // Invalidate the virtual scroll user list query (used by UserList component)
            await queryClient.invalidateQueries({
                queryKey: ["users-virtual"],
            });
            // Also invalidate the specific user query to ensure fresh data on reload
            if (editedUser.id) {
                await queryClient.invalidateQueries({
                    queryKey: ["user", editedUser.id],
                });
            }

            if (isNewUser || !editedUser.id) {
                redirectToUsersList(targetAccountId);
            } else {
                // For existing users, redirect back to the previous page
                if (window.history.length > 1) {
                    window.history.back();
                } else {
                    redirectToUsersList(targetAccountId);
                }
            }
        } catch (error: any) {
            showError(
                t("messages.toast_unexpected_error", { ns: "users" })
            );
        } finally {
            if (!saveInFlightRef.current) {
                setIsSaving(false);
            }
        }
    };

    const handleCancel = () => {
        if (isNewUser) {
            const cancelTargetAccountId = accountIdFromParams
                ? parseInt(accountIdFromParams, 10)
                : effectiveAccountId;
            router.push(getUsersListPath(cancelTargetAccountId));
        } else {
            setIsEditing(false);
            setValidationErrors({});
            if (user) {
                setEditedUser({
                    id: user.id,
                    first_name: user.first_name || "",
                    last_name: user.last_name || "",
                    username: user.username || "",
                    email: user.email || "",
                    mobile: user.mobile || "",
                    role: user.role || "",
                    status: user.status || "Active",
                    language: user.language || "English",
                    time_zone: user.time_zone || "",
                    locale: user.locale || "en-US",
                    freeze: user.freeze || false,
                    failed_login_attempts: user.failed_login_attempts || 0,
                    business_unit_id: user.business_unit_id || null,
                });
            }
        }
    };

    const handleFieldChange = (key: string, value: any) => {
        // Prevent users from deactivating themselves
        if (key === "status" && value === "Inactive" && isOwnProfile) {
            showError(t("messages.cannot_deactivate_self", { ns: "users" }));
            return;
        }

        setEditedUser((prev) => ({ ...prev, [key]: value }));

        setValidationErrors((prev) => {
            const newErrors = { ...prev };

            // Real-time email validation
            if (key === "email") {
                const emailValidation = validateEmail(value, t);
                if (!emailValidation.isValid && value.trim()) {
                    newErrors.email =
                        emailValidation.message ||
                        t("common.validation.invalid_email");
                } else {
                    delete newErrors.email;
                }
            } else {
                // For other fields, just clear the error if it exists
                if (newErrors[key]) {
                    delete newErrors[key];
                }
            }
            return newErrors;
        });
    };

    const handlePasswordDialogClose = useCallback(() => {
        setPasswordDialogOpen(false);
    }, []);

    // Get user display name for title
    const getUserDisplayName = () => {
        if (isNewUser) {
            return t("actions.add_user", { ns: "users" });
        }

        const fullName =
            `${editedUser.first_name} ${editedUser.last_name}`.trim();
        if (fullName) {
            return fullName;
        }

        if (isOwnProfile) {
            return t("sections.my_profile", { ns: "users" });
        }

        return t("values.status_unnamed_user", { ns: "users" });
    };

    return (
        <Box
            sx={{
                bgcolor: "background.default",
                minHeight: "100vh",
                m: 0,
                p: 0,
                mt: { xs: -1, sm: -1.5 },
                mx: { xs: -1, sm: -1.5 },
                width: { xs: "calc(100% + 16px)", sm: "calc(100% + 24px)" },
                maxWidth: { xs: "calc(100% + 16px)", sm: "calc(100% + 24px)" },
            }}
        >
            {/* Sticky User Header */}
            <Box
                ref={headerRef}
                sx={{
                    position: "sticky",
                    top: { xs: "-8px", sm: "-12px" },
                    left: 0,
                    right: 0,
                    zIndex: 30,
                    bgcolor: "background.paper",
                    flexShrink: 0,
                    m: 0,
                    mt: 0,
                    backgroundColor: "background.paper",
                    width: "100%",
                    maxWidth: "100%",
                    px: { xs: 1, sm: 1.5 },
                    pt: { xs: 1, sm: 1.5 },
                }}
            >
                <Box>
                    {/* Breadcrumbs */}
                    <Breadcrumbs
                        sx={{
                            mb: 1,
                            width: "100%",
                            direction:
                                i18n.language === "he" ? "rtl" : "ltr",
                            "& .MuiBreadcrumbs-ol": {
                                flexWrap: "nowrap",
                                overflow: "hidden",
                                width: "100%",
                                display: "flex",
                                alignItems: "center",
                                flexDirection:
                                    i18n.language === "he"
                                        ? "row-reverse"
                                        : "row",
                                justifyContent:
                                    i18n.language === "he"
                                        ? "flex-end"
                                        : "flex-start",
                            },
                            "& .MuiBreadcrumbs-li": {
                                minWidth: 0,
                                flexShrink: 1,
                                maxWidth: "none",
                                padding: 0,
                                margin: 0,
                            },
                            "& .MuiBreadcrumbs-separator": {
                                marginLeft:
                                    i18n.language === "he"
                                        ? 0
                                        : theme.spacing(0.5),
                                marginRight:
                                    i18n.language === "he"
                                        ? theme.spacing(0.5)
                                        : theme.spacing(0.5),
                            },
                        }}
                    >
                        {(() => {
                            const breadcrumbItems =
                                accountIdFromParams && account?.name
                                    ? [
                                        <Link
                                            key="accounts"
                                            component="button"
                                            variant="body1"
                                            onClick={() =>
                                                window.history.back()
                                            }
                                            sx={{
                                                textDecoration: "none",
                                                color: "primary.main",
                                                whiteSpace: "nowrap",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                minWidth: 0,
                                                flexShrink: 1,
                                                display: "block",
                                                maxWidth: "none",
                                                direction:
                                                    i18n.language === "he"
                                                        ? "rtl"
                                                        : "ltr",
                                                textAlign:
                                                    i18n.language === "he"
                                                        ? "right"
                                                        : "left",
                                            }}
                                        >
                                            {t(
                                                "sections.accounts_title",
                                                { ns: "accounts" }
                                            )}
                                        </Link>,
                                        <Link
                                            key="account-name"
                                            component="button"
                                            variant="body1"
                                            onClick={() =>
                                                window.history.back()
                                            }
                                            sx={{
                                                textDecoration: "none",
                                                color: "primary.main",
                                                whiteSpace: "nowrap",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                minWidth: 0,
                                                flexShrink: 1,
                                                display: "block",
                                                maxWidth: "none",
                                                direction:
                                                    i18n.language === "he"
                                                        ? "rtl"
                                                        : "ltr",
                                                textAlign:
                                                    i18n.language === "he"
                                                        ? "right"
                                                        : "left",
                                            }}
                                        >
                                            {account.name}
                                        </Link>,
                                        <Typography
                                            key="current"
                                            color="text.primary"
                                            sx={{
                                                whiteSpace: "nowrap",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                minWidth: 0,
                                                flexShrink: 1,
                                                display: "block",
                                                maxWidth: "none",
                                                direction:
                                                    i18n.language === "he"
                                                        ? "rtl"
                                                        : "ltr",
                                                textAlign:
                                                    i18n.language === "he"
                                                        ? "right"
                                                        : "left",
                                            }}
                                        >
                                            {getUserDisplayName()}
                                        </Typography>,
                                    ]
                                    : [
                                        <Link
                                            key="settings"
                                            component="button"
                                            variant="body1"
                                            onClick={() =>
                                                window.history.back()
                                            }
                                            sx={{
                                                textDecoration: "none",
                                                color: "primary.main",
                                                whiteSpace: "nowrap",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                minWidth: 0,
                                                flexShrink: 1,
                                                display: "block",
                                                maxWidth: "none",
                                                direction:
                                                    i18n.language === "he"
                                                        ? "rtl"
                                                        : "ltr",
                                                textAlign:
                                                    i18n.language === "he"
                                                        ? "right"
                                                        : "left",
                                            }}
                                        >
                                            {t("fields.title", {
                                                ns: "settings",
                                            })}
                                        </Link>,
                                        <Typography
                                            key="current"
                                            color="text.primary"
                                            sx={{
                                                whiteSpace: "nowrap",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                minWidth: 0,
                                                flexShrink: 1,
                                                display: "block",
                                                maxWidth: "none",
                                                direction:
                                                    i18n.language === "he"
                                                        ? "rtl"
                                                        : "ltr",
                                                textAlign:
                                                    i18n.language === "he"
                                                        ? "right"
                                                        : "left",
                                            }}
                                        >
                                            {getUserDisplayName()}
                                        </Typography>,
                                    ];
                            return i18n.language === "he"
                                ? breadcrumbItems.slice().reverse()
                                : breadcrumbItems;
                        })()}
                    </Breadcrumbs>

                    <Box sx={{ "& .MuiPaper-root": { mb: 0 } }}>
                        <PageHeader
                            title={getUserDisplayName()}
                            sticky={false}
                        >
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    ml: {
                                        xs: 0,
                                        sm: i18n.language === "he" ? 0 : "auto",
                                    },
                                    mr: {
                                        xs: 0,
                                        sm: i18n.language === "he" ? "auto" : 0,
                                    },
                                    mt: { xs: 2, sm: 0 },
                                }}
                            >
                                <Stack
                                    direction="row"
                                    alignItems="center"
                                    className="edit-action-button-group"
                                    sx={{
                                        direction:
                                            i18n.language === "he"
                                                ? "rtl"
                                                : "ltr",
                                    }}
                                >
                                    {/* Edit/Save/Cancel Buttons */}
                                    {!isNewUser &&
                                        !isEditing &&
                                        hasManageUsersPermission &&
                                        !isViewAsMode && (
                                            <Button
                                                variant="contained"
                                                onClick={() =>
                                                    setIsEditing(true)
                                                }
                                                sx={{
                                                    bgcolor: "primary.main",
                                                    color: "white",
                                                    textTransform: "none",
                                                    fontWeight: 600,
                                                    boxShadow:
                                                        "0 2px 8px rgba(25, 118, 210, 0.3)",
                                                    "&:hover": {
                                                        bgcolor: "primary.dark",
                                                        boxShadow:
                                                            "0 4px 12px rgba(25, 118, 210, 0.4)",
                                                        transform:
                                                            "translateY(-1px)",
                                                    },
                                                    "&:active": {
                                                        transform:
                                                            "translateY(0)",
                                                    },
                                                    transition:
                                                        "all 0.2s ease-in-out",
                                                }}
                                            >
                                                {t("actions.edit", {
                                                    ns: "common",
                                                })}
                                            </Button>
                                        )}

                                    {(isNewUser || isEditing) && (
                                        <>
                                            <Button
                                                variant="outlined"
                                                className="cancel-button"
                                                onClick={handleCancel}
                                                disabled={isSaving}
                                            >
                                                {t("actions.cancel", {
                                                    ns: "common",
                                                })}
                                            </Button>
                                            <Button
                                                variant="contained"
                                                className="save-button"
                                                type="button"
                                                onClick={
                                                    isSaving ||
                                                        Object.keys(
                                                            validationErrors
                                                        ).length > 0 ||
                                                        usernameExists ||
                                                        isCheckingUsername ||
                                                        isViewAsMode
                                                        ? undefined
                                                        : handleSave
                                                }
                                                disabled={
                                                    isSaving ||
                                                    Object.keys(
                                                        validationErrors
                                                    ).length > 0 ||
                                                    usernameExists ||
                                                    isCheckingUsername ||
                                                    isViewAsMode
                                                }
                                                sx={{
                                                    "& .MuiButton-endIcon": {
                                                        marginRight:
                                                            i18n.language ===
                                                                "he"
                                                                ? theme.spacing(
                                                                    1
                                                                )
                                                                : undefined,
                                                        marginLeft:
                                                            i18n.language !==
                                                                "he"
                                                                ? undefined
                                                                : theme.spacing(
                                                                    1
                                                                ),
                                                    },
                                                }}
                                            >
                                                {t("actions.save", {
                                                    ns: "common",
                                                })}
                                            </Button>
                                        </>
                                    )}
                                </Stack>
                            </Box>
                        </PageHeader>
                    </Box>
                </Box>
            </Box>

            <Box
                sx={{
                    py: { xs: 2, sm: 3 },
                    px: { xs: 1, sm: 1.5 },
                }}
            >
                <Fade in timeout={400}>
                    <Box>
                        {/* Main Content - Responsive Grid Layout */}
                        <Box sx={{ width: "100%" }}>
                            <Box
                                sx={{
                                    display: "grid",
                                    gridTemplateColumns: "1fr",
                                    gap: 1,
                                    "& .MuiCardContent-root": {
                                        paddingTop: theme.spacing(1),
                                        paddingBottom: theme.spacing(1),
                                    },
                                }}
                            >
                                {/* Personal Information Section */}
                                <Card
                                    elevation={0}
                                    sx={{
                                        borderRadius: theme.shape.borderRadius,
                                        border: "none",
                                        bgcolor: "transparent",
                                        boxShadow: "none",
                                    }}
                                >
                                    <CardContent>
                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 1,
                                                mb: 3,
                                            }}
                                        >
                                            <PersonIcon color="primary" />
                                            <Typography variant="h6">
                                                {t(
                                                    "sections.personal_information"
                                                )}
                                            </Typography>
                                        </Box>
                                        {/* First Row: First Name and Last Name */}
                                        <Box
                                            sx={{
                                                display: "grid",
                                                gridTemplateColumns: {
                                                    xs: "1fr",
                                                    md: "repeat(6, 1fr)",
                                                },
                                                gap: 3,
                                                mb: 3,
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    position: "relative",
                                                    gridColumn: {
                                                        md: "span 2",
                                                    },
                                                }}
                                            >
                                                <TextField
                                                    inputRef={firstNameInputRef}
                                                    fullWidth
                                                    label={t(
                                                        "fields.first_name"
                                                    )}
                                                    value={
                                                        editedUser.first_name
                                                    }
                                                    onChange={(e) =>
                                                        handleFieldChange(
                                                            "first_name",
                                                            e.target.value
                                                        )
                                                    }
                                                    error={
                                                        !!validationErrors.first_name
                                                    }
                                                    helperText={
                                                        validationErrors.first_name
                                                    }
                                                    disabled={!isEditing}
                                                    required
                                                    {...(i18n.language ===
                                                        "he" && {
                                                        "data-hebrew": true,
                                                    })}
                                                    inputProps={{
                                                        "aria-required": "true",
                                                        required: false,
                                                    }}
                                                />
                                            </Box>
                                            <Box
                                                sx={{
                                                    position: "relative",
                                                    gridColumn: {
                                                        md: "span 2",
                                                    },
                                                }}
                                            >
                                                <TextField
                                                    fullWidth
                                                    label={t(
                                                        "fields.last_name"
                                                    )}
                                                    value={editedUser.last_name}
                                                    onChange={(e) =>
                                                        handleFieldChange(
                                                            "last_name",
                                                            e.target.value
                                                        )
                                                    }
                                                    error={
                                                        !!validationErrors.last_name
                                                    }
                                                    helperText={
                                                        validationErrors.last_name
                                                    }
                                                    disabled={!isEditing}
                                                    required
                                                    {...(i18n.language ===
                                                        "he" && {
                                                        "data-hebrew": true,
                                                    })}
                                                    inputProps={{
                                                        "aria-required": "true",
                                                        required: false,
                                                    }}
                                                />
                                            </Box>
                                        </Box>

                                        {/* Second Row: Email, Username */}
                                        <Box
                                            sx={{
                                                display: "grid",
                                                gridTemplateColumns: {
                                                    xs: "1fr",
                                                    md: "repeat(6, 1fr)",
                                                },
                                                gap: 3,
                                                mb: 3,
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    position: "relative",
                                                    gridColumn: {
                                                        md: "span 2",
                                                    },
                                                }}
                                            >
                                                <TextField
                                                    fullWidth
                                                    label={t(
                                                        "fields.email"
                                                    )}
                                                    value={
                                                        editedUser.email
                                                    }
                                                    onChange={(e) =>
                                                        handleFieldChange(
                                                            "email",
                                                            e.target.value
                                                        )
                                                    }
                                                    onBlur={(e) => {
                                                        const emailValue =
                                                            e.target.value?.trim();
                                                        if (emailValue) {
                                                            setEditedUser(
                                                                (prev) =>
                                                                    !prev.username?.trim()
                                                                        ? {
                                                                            ...prev,
                                                                            username:
                                                                                emailValue,
                                                                        }
                                                                        : prev
                                                            );
                                                        }
                                                    }}
                                                    error={
                                                        !!validationErrors.email
                                                    }
                                                    helperText={
                                                        validationErrors.email
                                                    }
                                                    disabled={
                                                        !isEditing ||
                                                        (!isNewUser &&
                                                            !isSystemOrArchaserAdmin)
                                                    }
                                                    required
                                                    type="email"
                                                    {...(i18n.language ===
                                                        "he" && {
                                                        "data-hebrew": true,
                                                    })}
                                                    InputProps={{
                                                        endAdornment: (
                                                            <>
                                                                {!isNewUser &&
                                                                    !isSystemOrArchaserAdmin && (
                                                                        <InputAdornment position="end">
                                                                            <Tooltip
                                                                                title={t(
                                                                                    "messages.only_system_administrator_can_change",
                                                                                    {
                                                                                        ns: "users",
                                                                                        defaultValue:
                                                                                            "Only a system administrator can change this field.",
                                                                                    }
                                                                                )}
                                                                                arrow
                                                                                enterDelay={300}
                                                                                leaveDelay={100}
                                                                                placement="bottom"
                                                                                PopperProps={{
                                                                                    sx: {
                                                                                        "& .MuiTooltip-tooltip":
                                                                                        {
                                                                                            direction:
                                                                                                isHebrewUser
                                                                                                    ? "rtl"
                                                                                                    : "ltr",
                                                                                        },
                                                                                        "& .MuiTooltip-arrow":
                                                                                        {
                                                                                            ...(isHebrewUser && {
                                                                                                transform: "scaleX(-1)",
                                                                                            }),
                                                                                        },
                                                                                    },
                                                                                }}
                                                                            >
                                                                                <IconButton
                                                                                    size="small"
                                                                                    aria-label={t(
                                                                                        "messages.only_system_administrator_can_change",
                                                                                        {
                                                                                            ns: "users",
                                                                                            defaultValue:
                                                                                                "Only a system administrator can change this field.",
                                                                                        }
                                                                                    )}
                                                                                    sx={{
                                                                                        p: 0.5,
                                                                                        pointerEvents: "auto",
                                                                                        "&:hover": {
                                                                                            backgroundColor: "transparent",
                                                                                        },
                                                                                        "&.Mui-focusVisible":
                                                                                        {
                                                                                            backgroundColor: "transparent",
                                                                                        },
                                                                                        "&.Mui-disabled": {
                                                                                            backgroundColor: "transparent",
                                                                                        },
                                                                                    }}
                                                                                >
                                                                                    <InfoOutlinedIcon
                                                                                        fontSize="small"
                                                                                        color="action"
                                                                                    />
                                                                                </IconButton>
                                                                            </Tooltip>
                                                                        </InputAdornment>
                                                                    )}
                                                            </>
                                                        ),
                                                        readOnly:
                                                            !isNewUser &&
                                                            !isSystemOrArchaserAdmin,
                                                    }}
                                                    inputProps={{
                                                        "aria-required": "true",
                                                        required: false,
                                                        "aria-describedby":
                                                            "email-helper-text",
                                                    }}
                                                />
                                            </Box>
                                            <Box
                                                sx={{
                                                    position: "relative",
                                                    gridColumn: {
                                                        md: "span 2",
                                                    },
                                                }}
                                            >
                                                <TextField
                                                    fullWidth
                                                    label={t(
                                                        "fields.username"
                                                    )}
                                                    value={
                                                        editedUser.username
                                                    }
                                                    onChange={(e) =>
                                                        handleFieldChange(
                                                            "username",
                                                            e.target.value
                                                        )
                                                    }
                                                    onBlur={(e) => {
                                                        if (e.target.value) {
                                                            checkUsernameExists(
                                                                e.target.value
                                                            );
                                                        }
                                                    }}
                                                    error={
                                                        !!validationErrors.username
                                                    }
                                                    disabled={
                                                        !isEditing ||
                                                        (!isNewUser &&
                                                            !isSystemOrArchaserAdmin)
                                                    }
                                                    required
                                                    {...(i18n.language ===
                                                        "he" && {
                                                        "data-hebrew": true,
                                                    })}
                                                    InputProps={{
                                                        endAdornment: (
                                                            <>
                                                                {isCheckingUsername && (
                                                                    <CircularProgress
                                                                        color="primary"
                                                                        size={16}
                                                                    />
                                                                )}
                                                                {!isNewUser &&
                                                                    !isSystemOrArchaserAdmin && (
                                                                        <InputAdornment position="end">
                                                                            <Tooltip
                                                                                title={t(
                                                                                    "messages.only_system_administrator_can_change",
                                                                                    {
                                                                                        ns: "users",
                                                                                        defaultValue:
                                                                                            "Only a system administrator can change this field.",
                                                                                    }
                                                                                )}
                                                                                arrow
                                                                                enterDelay={300}
                                                                                leaveDelay={100}
                                                                                placement="bottom"
                                                                                PopperProps={{
                                                                                    sx: {
                                                                                        "& .MuiTooltip-tooltip":
                                                                                        {
                                                                                            direction:
                                                                                                isHebrewUser
                                                                                                    ? "rtl"
                                                                                                    : "ltr",
                                                                                        },
                                                                                        "& .MuiTooltip-arrow":
                                                                                        {
                                                                                            ...(isHebrewUser && {
                                                                                                transform: "scaleX(-1)",
                                                                                            }),
                                                                                        },
                                                                                    },
                                                                                }}
                                                                            >
                                                                                <IconButton
                                                                                    size="small"
                                                                                    aria-label={t(
                                                                                        "messages.only_system_administrator_can_change",
                                                                                        {
                                                                                            ns: "users",
                                                                                            defaultValue:
                                                                                                "Only a system administrator can change this field.",
                                                                                        }
                                                                                    )}
                                                                                    sx={{
                                                                                        p: 0.5,
                                                                                        pointerEvents: "auto",
                                                                                        "&:hover": {
                                                                                            backgroundColor: "transparent",
                                                                                        },
                                                                                        "&.Mui-focusVisible":
                                                                                        {
                                                                                            backgroundColor: "transparent",
                                                                                        },
                                                                                        "&.Mui-disabled": {
                                                                                            backgroundColor: "transparent",
                                                                                        },
                                                                                    }}
                                                                                >
                                                                                    <InfoOutlinedIcon
                                                                                        fontSize="small"
                                                                                        color="action"
                                                                                    />
                                                                                </IconButton>
                                                                            </Tooltip>
                                                                        </InputAdornment>
                                                                    )}
                                                            </>
                                                        ),
                                                        readOnly:
                                                            !isNewUser &&
                                                            !isSystemOrArchaserAdmin,
                                                    }}
                                                    helperText={
                                                        isCheckingUsername
                                                            ? t(
                                                                "messages.validation_checking_username"
                                                            )
                                                            : validationErrors.username ||
                                                            ""
                                                    }
                                                    inputProps={{
                                                        "aria-required": "true",
                                                        required: false,
                                                    }}
                                                />
                                            </Box>
                                        </Box>

                                        {/* Third Row: Mobile */}
                                        <Box
                                            sx={{
                                                display: "grid",
                                                gridTemplateColumns: {
                                                    xs: "1fr",
                                                    md: "repeat(6, 1fr)",
                                                },
                                                gap: 3,
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    position: "relative",
                                                    gridColumn: {
                                                        md: "span 2",
                                                    },
                                                }}
                                            >
                                                <TextField
                                                    fullWidth
                                                    label={t("fields.mobile")}
                                                    placeholder={t(
                                                        "fields.mobile"
                                                    )}
                                                    value={editedUser.mobile}
                                                    onChange={(e) =>
                                                        handleFieldChange(
                                                            "mobile",
                                                            e.target.value
                                                        )
                                                    }
                                                    disabled={!isEditing}
                                                    {...(i18n.language ===
                                                        "he" && {
                                                        "data-hebrew": true,
                                                    })}
                                                />
                                            </Box>
                                        </Box>
                                    </CardContent>
                                </Card>

                                {/* Account Status Section - Combined Status and Freeze */}
                                <Card
                                    elevation={0}
                                    sx={{
                                        borderRadius: theme.shape.borderRadius,
                                        border: "none",
                                        bgcolor: "transparent",
                                        boxShadow: "none",
                                    }}
                                >
                                    <CardContent>
                                        <Typography variant="h6" sx={{ mb: 1 }}>
                                            {t("sections.status")}
                                        </Typography>
                                        <Box
                                            sx={{
                                                display: "grid",
                                                gridTemplateColumns: {
                                                    xs: "1fr",
                                                    md: "repeat(6, 1fr)",
                                                },
                                                gap: 3,
                                                mb: 3,
                                            }}
                                        >
                                            {editedUser.freeze && (
                                                <Alert
                                                    severity="warning"
                                                    sx={{
                                                        gridColumn: {
                                                            md: "span 6",
                                                        },
                                                        mb: 0,
                                                        "& .MuiAlert-icon": {
                                                            marginLeft:
                                                                i18n.language ===
                                                                    "he"
                                                                    ? 1
                                                                    : undefined,
                                                        },
                                                    }}
                                                >
                                                    {t(
                                                        "messages.account_frozen_admin",
                                                        { ns: "users" }
                                                    )}
                                                </Alert>
                                            )}
                                        </Box>
                                        {/* First Row: Status and Freeze */}
                                        <Box
                                            sx={{
                                                display: "grid",
                                                gridTemplateColumns: {
                                                    xs: "1fr",
                                                    md: "repeat(6, 1fr)",
                                                },
                                                gap: 3,
                                                mb: 3,
                                            }}
                                        >
                                            {/* Status Switch */}
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    gridColumn: {
                                                        md: "span 2",
                                                    },
                                                }}
                                            >
                                                <Box
                                                    sx={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 0.5,
                                                        mb: 1,
                                                    }}
                                                >
                                                    <Typography
                                                        variant="body2"
                                                        sx={{
                                                            fontWeight: 500,
                                                        }}
                                                    >
                                                        {t("fields.status", {
                                                            ns: "common",
                                                        })}
                                                    </Typography>
                                                    {isOwnProfile && (
                                                        <Tooltip
                                                            title={t(
                                                                "messages.cannot_deactivate_self",
                                                                { ns: "users" }
                                                            )}
                                                            arrow
                                                            enterDelay={300}
                                                            leaveDelay={100}
                                                            placement="bottom"
                                                            PopperProps={{
                                                                sx: {
                                                                    "& .MuiTooltip-tooltip":
                                                                    {
                                                                        direction: isHebrewUser
                                                                            ? "rtl"
                                                                            : "ltr",
                                                                    },
                                                                    "& .MuiTooltip-arrow":
                                                                    {
                                                                        ...(isHebrewUser && {
                                                                            transform: "scaleX(-1)",
                                                                        }),
                                                                    },
                                                                },
                                                            }}
                                                        >
                                                            <InfoOutlinedIcon
                                                                sx={{
                                                                    fontSize: 18,
                                                                    cursor: "help",
                                                                }}
                                                            />
                                                        </Tooltip>
                                                    )}
                                                </Box>
                                                <FormControlLabel
                                                    control={
                                                        <Switch
                                                            checked={
                                                                editedUser.status ===
                                                                "Active"
                                                            }
                                                            onChange={(e) => {
                                                                // Automatically enable editing mode if user has manage_users permission
                                                                if (
                                                                    !isEditing &&
                                                                    hasManageUsersPermission &&
                                                                    !isViewAsMode
                                                                ) {
                                                                    setIsEditing(
                                                                        true
                                                                    );
                                                                }
                                                                handleFieldChange(
                                                                    "status",
                                                                    e.target
                                                                        .checked
                                                                        ? "Active"
                                                                        : "Inactive"
                                                                );
                                                            }}
                                                            color="primary"
                                                            disabled={
                                                                !hasManageUsersPermission ||
                                                                isOwnProfile ||
                                                                isViewAsMode
                                                            }
                                                        />
                                                    }
                                                    label={
                                                        editedUser.status ===
                                                            "Active"
                                                            ? t(
                                                                "values.status_active",
                                                                {
                                                                    ns: "common",
                                                                }
                                                            )
                                                            : t(
                                                                "values.status_inactive",
                                                                {
                                                                    ns: "common",
                                                                }
                                                            )
                                                    }
                                                />
                                            </Box>

                                            {/* Freeze Switch */}
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    gridColumn: {
                                                        md: "span 2",
                                                    },
                                                }}
                                            >
                                                <Typography
                                                    variant="body2"
                                                    sx={{
                                                        mb: 1,
                                                        fontWeight: 500,
                                                    }}
                                                >
                                                    {t("fields.freeze", {
                                                        ns: "users",
                                                    })}
                                                </Typography>
                                                <FormControlLabel
                                                    control={
                                                        <Switch
                                                            checked={
                                                                editedUser.freeze ||
                                                                false
                                                            }
                                                            onChange={(e) =>
                                                                handleFieldChange(
                                                                    "freeze",
                                                                    e.target
                                                                        .checked
                                                                )
                                                            }
                                                            color="primary"
                                                            disabled={
                                                                !isEditing ||
                                                                !hasManageUsersPermission
                                                            }
                                                        />
                                                    }
                                                    label={
                                                        editedUser.freeze
                                                            ? t("fields.yes", {
                                                                ns: "common",
                                                            })
                                                            : t("fields.no", {
                                                                ns: "common",
                                                            })
                                                    }
                                                />
                                            </Box>

                                            {/* Empty Columns */}
                                            <Box
                                                sx={{
                                                    display: {
                                                        xs: "none",
                                                        md: "block",
                                                    },
                                                    gridColumn: {
                                                        md: "span 2",
                                                    },
                                                }}
                                            />
                                        </Box>

                                        {/* Second Row: Business Unit and Role */}
                                        <Box
                                            sx={{
                                                display: "grid",
                                                gridTemplateColumns: {
                                                    xs: "1fr",
                                                    md: "repeat(6, 1fr)",
                                                },
                                                gap: 3,
                                            }}
                                        >
                                            {/* Business Unit Field */}
                                            <Box
                                                sx={{
                                                    gridColumn: {
                                                        md: "span 2",
                                                    },
                                                }}
                                            >
                                                <Autocomplete
                                                    fullWidth
                                                    options={businessUnits}
                                                    getOptionLabel={(option) =>
                                                        option.name || ""
                                                    }
                                                    isOptionEqualToValue={(
                                                        option,
                                                        value
                                                    ) =>
                                                        option.id === value?.id
                                                    }
                                                    value={
                                                        businessUnits.length >
                                                            0 &&
                                                            editedUser.business_unit_id
                                                            ? businessUnits.find(
                                                                (bu) =>
                                                                    bu.id ===
                                                                    editedUser.business_unit_id
                                                            ) || null
                                                            : null
                                                    }
                                                    onChange={(_, newValue) => {
                                                        handleFieldChange(
                                                            "business_unit_id",
                                                            newValue?.id || null
                                                        );
                                                        // Clear role if System_Administrator and new BU is not primary
                                                        if (
                                                            editedUser.role ===
                                                            "System_Administrator" &&
                                                            newValue &&
                                                            !newValue.is_primary
                                                        ) {
                                                            handleFieldChange(
                                                                "role",
                                                                ""
                                                            );
                                                        }
                                                    }}
                                                    disabled={
                                                        !isEditing ||
                                                        editedUser.role ===
                                                        "System_Administrator" ||
                                                        editedUser.role ===
                                                        "System Administrator"
                                                    }
                                                    loading={!businessUnitsData}
                                                    renderOption={(
                                                        props,
                                                        option
                                                    ) => {
                                                        const {
                                                            key,
                                                            ...otherProps
                                                        } = props;
                                                        return (
                                                            <li
                                                                key={key}
                                                                {...otherProps}
                                                                style={{
                                                                    direction:
                                                                        i18n.language ===
                                                                            "he"
                                                                            ? "rtl"
                                                                            : "ltr",
                                                                    textAlign:
                                                                        i18n.language ===
                                                                            "he"
                                                                            ? "right"
                                                                            : "left",
                                                                    paddingRight:
                                                                        i18n.language ===
                                                                            "he"
                                                                            ? "16px"
                                                                            : "14px",
                                                                    paddingLeft:
                                                                        i18n.language ===
                                                                            "he"
                                                                            ? "14px"
                                                                            : "16px",
                                                                }}
                                                            >
                                                                <Typography
                                                                    sx={{
                                                                        direction:
                                                                            i18n.language ===
                                                                                "he"
                                                                                ? "rtl"
                                                                                : "ltr",
                                                                        textAlign:
                                                                            i18n.language ===
                                                                                "he"
                                                                                ? "right"
                                                                                : "left",
                                                                        width: "100%",
                                                                    }}
                                                                >
                                                                    {option.name || ""}
                                                                </Typography>
                                                            </li>
                                                        );
                                                    }}
                                                    sx={{
                                                        "& .MuiAutocomplete-inputRoot":
                                                        {
                                                            direction:
                                                                i18n.language ===
                                                                    "he"
                                                                    ? "rtl"
                                                                    : "ltr",
                                                            "& .MuiAutocomplete-input":
                                                            {
                                                                textAlign:
                                                                    i18n.language ===
                                                                        "he"
                                                                        ? "right !important"
                                                                        : "left",
                                                                direction:
                                                                    i18n.language ===
                                                                        "he"
                                                                        ? "rtl !important"
                                                                        : "ltr",
                                                            },
                                                            "& input": {
                                                                textAlign:
                                                                    i18n.language ===
                                                                        "he"
                                                                        ? "right !important"
                                                                        : "left",
                                                                direction:
                                                                    i18n.language ===
                                                                        "he"
                                                                        ? "rtl !important"
                                                                        : "ltr",
                                                            },
                                                        },
                                                        "& .MuiAutocomplete-endAdornment":
                                                        {
                                                            right:
                                                                i18n.language ===
                                                                    "he"
                                                                    ? "auto"
                                                                    : undefined,
                                                            left:
                                                                i18n.language ===
                                                                    "he"
                                                                    ? theme.spacing(
                                                                        1.5
                                                                    )
                                                                    : "auto",
                                                        },
                                                    }}
                                                    renderInput={(params) => (
                                                        <TextField
                                                            {...params}
                                                            label={t(
                                                                "fields.business_unit"
                                                            )}
                                                            required
                                                            error={
                                                                !!validationErrors.business_unit_id
                                                            }
                                                            helperText={
                                                                validationErrors.business_unit_id
                                                            }
                                                            {...(i18n.language ===
                                                                "he" && {
                                                                "data-hebrew": true,
                                                            })}
                                                            dir={
                                                                i18n.language ===
                                                                    "he"
                                                                    ? "rtl"
                                                                    : "ltr"
                                                            }
                                                            {...(i18n.language ===
                                                                "he" && {
                                                                "data-rtl": true,
                                                            })}
                                                            sx={{
                                                                "& .MuiInputBase-input":
                                                                {
                                                                    textAlign:
                                                                        i18n.language ===
                                                                            "he"
                                                                            ? "right"
                                                                            : "left",
                                                                    direction:
                                                                        i18n.language ===
                                                                            "he"
                                                                            ? "rtl"
                                                                            : "ltr",
                                                                },
                                                                "& .MuiInputLabel-root":
                                                                {
                                                                    textAlign:
                                                                        i18n.language ===
                                                                            "he"
                                                                            ? "right"
                                                                            : "left",
                                                                    direction:
                                                                        i18n.language ===
                                                                            "he"
                                                                            ? "rtl"
                                                                            : "ltr",
                                                                },
                                                            }}
                                                        />
                                                    )}
                                                    dir={
                                                        i18n.language === "he"
                                                            ? "rtl"
                                                            : "ltr"
                                                    }
                                                    {...(i18n.language ===
                                                        "he" && {
                                                        "data-rtl": true,
                                                    })}
                                                />
                                            </Box>

                                            {/* Role Field */}
                                            <Box
                                                sx={{
                                                    gridColumn: {
                                                        md: "span 2",
                                                    },
                                                }}
                                            >
                                                <Autocomplete
                                                    fullWidth
                                                    options={availableRoles}
                                                    value={
                                                        editedUser.role || ""
                                                    }
                                                    onChange={(_, newValue) =>
                                                        handleFieldChange(
                                                            "role",
                                                            newValue || ""
                                                        )
                                                    }
                                                    disabled={
                                                        !isEditing ||
                                                        !editedUser.business_unit_id ||
                                                        // Only archaser_admin, Collection_Manager, and System_Administrator can change roles
                                                        // Temporary backward compatibility: also check for old "Admin" and "Account_Manager" roles during migration
                                                        !(
                                                            session?.user
                                                                ?.role ===
                                                            "archaser_admin" ||
                                                            session?.user
                                                                ?.role ===
                                                            "ARchaser Admin" ||
                                                            session?.user
                                                                ?.role ===
                                                            "Admin" ||
                                                            session?.user
                                                                ?.role ===
                                                            "Collection_Manager" ||
                                                            session?.user
                                                                ?.role ===
                                                            "Collection Manager" ||
                                                            session?.user
                                                                ?.role ===
                                                            "Account_Manager" ||
                                                            session?.user
                                                                ?.role ===
                                                            "System_Administrator" ||
                                                            session?.user
                                                                ?.role ===
                                                            "System Administrator" ||
                                                            session?.user
                                                                ?.account_id ===
                                                            10013
                                                        ) ||
                                                        isOwnProfile
                                                    }
                                                    getOptionLabel={(
                                                        option
                                                    ) => {
                                                        if (!option) return "";

                                                        // Use security_roles namespace with the role name directly
                                                        const translationKey = `values.${option}`;
                                                        const translated = t(
                                                            translationKey,
                                                            {
                                                                ns: "security_roles",
                                                                defaultValue:
                                                                    option,
                                                            }
                                                        );
                                                        // Return the translated value (all roles have translations in security_roles.json)
                                                        return translated;
                                                    }}
                                                    renderOption={(
                                                        props,
                                                        option
                                                    ) => {
                                                        const {
                                                            key,
                                                            ...otherProps
                                                        } = props;
                                                        return (
                                                            <li
                                                                key={key}
                                                                {...otherProps}
                                                                style={{
                                                                    direction:
                                                                        i18n.language ===
                                                                            "he"
                                                                            ? "rtl"
                                                                            : "ltr",
                                                                    textAlign:
                                                                        i18n.language ===
                                                                            "he"
                                                                            ? "right"
                                                                            : "left",
                                                                    paddingRight:
                                                                        i18n.language ===
                                                                            "he"
                                                                            ? "16px"
                                                                            : "14px",
                                                                    paddingLeft:
                                                                        i18n.language ===
                                                                            "he"
                                                                            ? "14px"
                                                                            : "16px",
                                                                }}
                                                            >
                                                                <Typography
                                                                    sx={{
                                                                        direction:
                                                                            i18n.language ===
                                                                                "he"
                                                                                ? "rtl"
                                                                                : "ltr",
                                                                        textAlign:
                                                                            i18n.language ===
                                                                                "he"
                                                                                ? "right"
                                                                                : "left",
                                                                        width: "100%",
                                                                    }}
                                                                >
                                                                    {(() => {
                                                                        if (
                                                                            !option
                                                                        )
                                                                            return "";

                                                                        // Use security_roles namespace with the role name directly
                                                                        const translationKey = `values.${option}`;
                                                                        const translated =
                                                                            t(
                                                                                translationKey,
                                                                                {
                                                                                    ns: "security_roles",
                                                                                    defaultValue:
                                                                                        option,
                                                                                }
                                                                            );
                                                                        // Return the translated value (all roles have translations in security_roles.json)
                                                                        return translated;
                                                                    })()}
                                                                </Typography>
                                                            </li>
                                                        );
                                                    }}
                                                    sx={{
                                                        "& .MuiAutocomplete-inputRoot":
                                                        {
                                                            direction:
                                                                i18n.language ===
                                                                    "he"
                                                                    ? "rtl"
                                                                    : "ltr",
                                                            "& .MuiAutocomplete-input":
                                                            {
                                                                textAlign:
                                                                    i18n.language ===
                                                                        "he"
                                                                        ? "right !important"
                                                                        : "left",
                                                                direction:
                                                                    i18n.language ===
                                                                        "he"
                                                                        ? "rtl !important"
                                                                        : "ltr",
                                                            },
                                                            "& input": {
                                                                textAlign:
                                                                    i18n.language ===
                                                                        "he"
                                                                        ? "right !important"
                                                                        : "left",
                                                                direction:
                                                                    i18n.language ===
                                                                        "he"
                                                                        ? "rtl !important"
                                                                        : "ltr",
                                                            },
                                                        },
                                                        "& .MuiAutocomplete-endAdornment":
                                                        {
                                                            right:
                                                                i18n.language ===
                                                                    "he"
                                                                    ? "auto"
                                                                    : undefined,
                                                            left:
                                                                i18n.language ===
                                                                    "he"
                                                                    ? theme.spacing(
                                                                        1.5
                                                                    )
                                                                    : "auto",
                                                        },
                                                    }}
                                                    renderInput={(params) => (
                                                        <TextField
                                                            {...params}
                                                            label={t(
                                                                "fields.role"
                                                            )}
                                                            required
                                                            error={
                                                                !!validationErrors.role
                                                            }
                                                            helperText={
                                                                validationErrors.role
                                                            }
                                                            {...(i18n.language ===
                                                                "he" && {
                                                                "data-hebrew": true,
                                                            })}
                                                            dir={
                                                                i18n.language ===
                                                                    "he"
                                                                    ? "rtl"
                                                                    : "ltr"
                                                            }
                                                            {...(i18n.language ===
                                                                "he" && {
                                                                "data-rtl": true,
                                                            })}
                                                            sx={{
                                                                "& .MuiInputBase-input":
                                                                {
                                                                    textAlign:
                                                                        i18n.language ===
                                                                            "he"
                                                                            ? "right"
                                                                            : "left",
                                                                    direction:
                                                                        i18n.language ===
                                                                            "he"
                                                                            ? "rtl"
                                                                            : "ltr",
                                                                },
                                                                "& .MuiInputLabel-root":
                                                                {
                                                                    textAlign:
                                                                        i18n.language ===
                                                                            "he"
                                                                            ? "right"
                                                                            : "left",
                                                                    direction:
                                                                        i18n.language ===
                                                                            "he"
                                                                            ? "rtl"
                                                                            : "ltr",
                                                                },
                                                            }}
                                                        />
                                                    )}
                                                    dir={
                                                        i18n.language === "he"
                                                            ? "rtl"
                                                            : "ltr"
                                                    }
                                                    {...(i18n.language ===
                                                        "he" && {
                                                        "data-rtl": true,
                                                    })}
                                                />
                                            </Box>

                                            {/* Empty Columns */}
                                            <Box
                                                sx={{
                                                    display: {
                                                        xs: "none",
                                                        md: "block",
                                                    },
                                                    gridColumn: {
                                                        md: "span 2",
                                                    },
                                                }}
                                            />
                                        </Box>
                                        {editedUser.failed_login_attempts !==
                                            undefined &&
                                            editedUser.failed_login_attempts >
                                            0 && (
                                                <Typography
                                                    variant="body2"
                                                    color="text.secondary"
                                                    sx={{ mt: 1.5 }}
                                                >
                                                    {t(
                                                        "fields.failed_login_attempts",
                                                        { ns: "users" }
                                                    )}
                                                    :{" "}
                                                    {
                                                        editedUser.failed_login_attempts
                                                    }
                                                </Typography>
                                            )}
                                    </CardContent>
                                </Card>

                                {/* Location Section */}
                                <Card
                                    elevation={0}
                                    sx={{
                                        borderRadius: theme.shape.borderRadius,
                                        border: "none",
                                        bgcolor: "transparent",
                                        boxShadow: "none",
                                    }}
                                >
                                    <CardContent>
                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 1,
                                                mb: 3,
                                            }}
                                        >
                                            <LocationIcon color="primary" />
                                            <Typography variant="h6">
                                                {t("sections.location")}
                                            </Typography>
                                        </Box>
                                        <Box
                                            sx={{
                                                display: "grid",
                                                gridTemplateColumns: {
                                                    xs: "1fr",
                                                    md: "repeat(6, 1fr)",
                                                },
                                                gap: 3,
                                            }}
                                        >
                                            {/* Language Field */}
                                            <Box
                                                sx={{
                                                    gridColumn: {
                                                        md: "span 2",
                                                    },
                                                }}
                                            >
                                                <Autocomplete
                                                    fullWidth
                                                    options={[
                                                        "English",
                                                        "Hebrew",
                                                        "German",
                                                        "Spanish",
                                                        "French",
                                                        "Italian",
                                                        "Portuguese",
                                                    ]}
                                                    value={
                                                        editedUser.language ||
                                                        ""
                                                    }
                                                    onChange={(_, newValue) =>
                                                        handleFieldChange(
                                                            "language",
                                                            newValue || ""
                                                        )
                                                    }
                                                    disabled={!isEditing}
                                                    getOptionLabel={(
                                                        option
                                                    ) => {
                                                        return t(
                                                            `common.languages.${option.toLowerCase()}`,
                                                            option
                                                        );
                                                    }}
                                                    renderOption={(
                                                        props,
                                                        option
                                                    ) => {
                                                        const {
                                                            key,
                                                            ...otherProps
                                                        } = props;
                                                        return (
                                                            <li
                                                                key={key}
                                                                {...otherProps}
                                                                style={{
                                                                    direction:
                                                                        i18n.language ===
                                                                            "he"
                                                                            ? "rtl"
                                                                            : "ltr",
                                                                    textAlign:
                                                                        i18n.language ===
                                                                            "he"
                                                                            ? "right"
                                                                            : "left",
                                                                    paddingRight:
                                                                        i18n.language ===
                                                                            "he"
                                                                            ? "16px"
                                                                            : "14px",
                                                                    paddingLeft:
                                                                        i18n.language ===
                                                                            "he"
                                                                            ? "14px"
                                                                            : "16px",
                                                                }}
                                                            >
                                                                <Typography
                                                                    sx={{
                                                                        direction:
                                                                            i18n.language ===
                                                                                "he"
                                                                                ? "rtl"
                                                                                : "ltr",
                                                                        textAlign:
                                                                            i18n.language ===
                                                                                "he"
                                                                                ? "right"
                                                                                : "left",
                                                                        width: "100%",
                                                                    }}
                                                                >
                                                                    {t(
                                                                        `common.languages.${option.toLowerCase()}`,
                                                                        option
                                                                    )}
                                                                </Typography>
                                                            </li>
                                                        );
                                                    }}
                                                    sx={{
                                                        "& .MuiAutocomplete-inputRoot":
                                                        {
                                                            direction:
                                                                i18n.language ===
                                                                    "he"
                                                                    ? "rtl"
                                                                    : "ltr",
                                                            "& .MuiAutocomplete-input":
                                                            {
                                                                textAlign:
                                                                    i18n.language ===
                                                                        "he"
                                                                        ? "right !important"
                                                                        : "left",
                                                                direction:
                                                                    i18n.language ===
                                                                        "he"
                                                                        ? "rtl !important"
                                                                        : "ltr",
                                                            },
                                                            "& input": {
                                                                textAlign:
                                                                    i18n.language ===
                                                                        "he"
                                                                        ? "right !important"
                                                                        : "left",
                                                                direction:
                                                                    i18n.language ===
                                                                        "he"
                                                                        ? "rtl !important"
                                                                        : "ltr",
                                                            },
                                                        },
                                                        "& .MuiAutocomplete-endAdornment":
                                                        {
                                                            right:
                                                                i18n.language ===
                                                                    "he"
                                                                    ? "auto"
                                                                    : undefined,
                                                            left:
                                                                i18n.language ===
                                                                    "he"
                                                                    ? theme.spacing(
                                                                        1.5
                                                                    )
                                                                    : "auto",
                                                        },
                                                    }}
                                                    renderInput={(params) => (
                                                        <TextField
                                                            {...params}
                                                            label={t(
                                                                "fields.language"
                                                            )}
                                                            required
                                                            {...(i18n.language ===
                                                                "he" && {
                                                                "data-hebrew": true,
                                                            })}
                                                            dir={
                                                                i18n.language ===
                                                                    "he"
                                                                    ? "rtl"
                                                                    : "ltr"
                                                            }
                                                            {...(i18n.language ===
                                                                "he" && {
                                                                "data-rtl": true,
                                                            })}
                                                            sx={{
                                                                "& .MuiInputBase-input":
                                                                {
                                                                    textAlign:
                                                                        i18n.language ===
                                                                            "he"
                                                                            ? "right"
                                                                            : "left",
                                                                    direction:
                                                                        i18n.language ===
                                                                            "he"
                                                                            ? "rtl"
                                                                            : "ltr",
                                                                },
                                                                "& .MuiInputLabel-root":
                                                                {
                                                                    textAlign:
                                                                        i18n.language ===
                                                                            "he"
                                                                            ? "right"
                                                                            : "left",
                                                                    direction:
                                                                        i18n.language ===
                                                                            "he"
                                                                            ? "rtl"
                                                                            : "ltr",
                                                                },
                                                            }}
                                                        />
                                                    )}
                                                    dir={
                                                        i18n.language === "he"
                                                            ? "rtl"
                                                            : "ltr"
                                                    }
                                                    {...(i18n.language ===
                                                        "he" && {
                                                        "data-rtl": true,
                                                    })}
                                                />
                                                {validationErrors.language && (
                                                    <Typography
                                                        variant="caption"
                                                        color="error"
                                                        sx={{
                                                            mt: 0.5,
                                                            ml: 1.5,
                                                        }}
                                                    >
                                                        {
                                                            validationErrors.language
                                                        }
                                                    </Typography>
                                                )}
                                            </Box>

                                            {/* Locale Field */}
                                            <Box
                                                sx={{
                                                    gridColumn: {
                                                        md: "span 2",
                                                    },
                                                }}
                                            >
                                                <Autocomplete
                                                    fullWidth
                                                    options={[
                                                        "en-US",
                                                        "en-GB",
                                                        "he-IL",
                                                        "fr-FR",
                                                        "de-DE",
                                                        "es-ES",
                                                        "pt-PT",
                                                        "it-IT",
                                                    ]}
                                                    value={
                                                        editedUser.locale || ""
                                                    }
                                                    onChange={(_, newValue) =>
                                                        handleFieldChange(
                                                            "locale",
                                                            newValue || ""
                                                        )
                                                    }
                                                    disabled={!isEditing}
                                                    getOptionLabel={(
                                                        option
                                                    ) => {
                                                        const localeMap: Record<
                                                            string,
                                                            string
                                                        > = {
                                                            "en-US":
                                                                "English (United States)",
                                                            "en-GB":
                                                                "English (United Kingdom)",
                                                            "he-IL":
                                                                "Hebrew (Israel)",
                                                            "fr-FR":
                                                                "French (France)",
                                                            "de-DE":
                                                                "German (Germany)",
                                                            "es-ES":
                                                                "Spanish (Spain)",
                                                            "pt-PT":
                                                                "Portuguese (Portugal)",
                                                            "it-IT":
                                                                "Italian (Italy)",
                                                        };
                                                        return (
                                                            localeMap[option] ||
                                                            option
                                                        );
                                                    }}
                                                    renderOption={(
                                                        props,
                                                        option
                                                    ) => {
                                                        const {
                                                            key,
                                                            ...otherProps
                                                        } = props;
                                                        const localeMap: Record<
                                                            string,
                                                            string
                                                        > = {
                                                            "en-US":
                                                                "English (United States)",
                                                            "en-GB":
                                                                "English (United Kingdom)",
                                                            "he-IL":
                                                                "Hebrew (Israel)",
                                                            "fr-FR":
                                                                "French (France)",
                                                            "de-DE":
                                                                "German (Germany)",
                                                            "es-ES":
                                                                "Spanish (Spain)",
                                                            "pt-PT":
                                                                "Portuguese (Portugal)",
                                                            "it-IT":
                                                                "Italian (Italy)",
                                                        };
                                                        return (
                                                            <li
                                                                key={key}
                                                                {...otherProps}
                                                                style={{
                                                                    direction:
                                                                        i18n.language ===
                                                                            "he"
                                                                            ? "rtl"
                                                                            : "ltr",
                                                                    textAlign:
                                                                        i18n.language ===
                                                                            "he"
                                                                            ? "right"
                                                                            : "left",
                                                                    paddingRight:
                                                                        i18n.language ===
                                                                            "he"
                                                                            ? "16px"
                                                                            : "14px",
                                                                    paddingLeft:
                                                                        i18n.language ===
                                                                            "he"
                                                                            ? "14px"
                                                                            : "16px",
                                                                }}
                                                            >
                                                                <Typography
                                                                    sx={{
                                                                        direction:
                                                                            i18n.language ===
                                                                                "he"
                                                                                ? "rtl"
                                                                                : "ltr",
                                                                        textAlign:
                                                                            i18n.language ===
                                                                                "he"
                                                                                ? "right"
                                                                                : "left",
                                                                        width: "100%",
                                                                    }}
                                                                >
                                                                    {localeMap[
                                                                        option
                                                                    ] || option}
                                                                </Typography>
                                                            </li>
                                                        );
                                                    }}
                                                    sx={{
                                                        "& .MuiAutocomplete-inputRoot":
                                                        {
                                                            direction:
                                                                i18n.language ===
                                                                    "he"
                                                                    ? "rtl"
                                                                    : "ltr",
                                                            "& .MuiAutocomplete-input":
                                                            {
                                                                textAlign:
                                                                    i18n.language ===
                                                                        "he"
                                                                        ? "right !important"
                                                                        : "left",
                                                                direction:
                                                                    i18n.language ===
                                                                        "he"
                                                                        ? "rtl !important"
                                                                        : "ltr",
                                                            },
                                                            "& input": {
                                                                textAlign:
                                                                    i18n.language ===
                                                                        "he"
                                                                        ? "right !important"
                                                                        : "left",
                                                                direction:
                                                                    i18n.language ===
                                                                        "he"
                                                                        ? "rtl !important"
                                                                        : "ltr",
                                                            },
                                                        },
                                                        "& .MuiAutocomplete-endAdornment":
                                                        {
                                                            right:
                                                                i18n.language ===
                                                                    "he"
                                                                    ? "auto"
                                                                    : undefined,
                                                            left:
                                                                i18n.language ===
                                                                    "he"
                                                                    ? theme.spacing(
                                                                        1.5
                                                                    )
                                                                    : "auto",
                                                        },
                                                    }}
                                                    renderInput={(params) => (
                                                        <TextField
                                                            {...params}
                                                            label={t(
                                                                "fields.locale"
                                                            )}
                                                            required
                                                            {...(i18n.language ===
                                                                "he" && {
                                                                "data-hebrew": true,
                                                            })}
                                                            dir={
                                                                i18n.language ===
                                                                    "he"
                                                                    ? "rtl"
                                                                    : "ltr"
                                                            }
                                                            {...(i18n.language ===
                                                                "he" && {
                                                                "data-rtl": true,
                                                            })}
                                                            sx={{
                                                                "& .MuiInputBase-input":
                                                                {
                                                                    textAlign:
                                                                        i18n.language ===
                                                                            "he"
                                                                            ? "right"
                                                                            : "left",
                                                                    direction:
                                                                        i18n.language ===
                                                                            "he"
                                                                            ? "rtl"
                                                                            : "ltr",
                                                                },
                                                                "& .MuiInputLabel-root":
                                                                {
                                                                    textAlign:
                                                                        i18n.language ===
                                                                            "he"
                                                                            ? "right"
                                                                            : "left",
                                                                    direction:
                                                                        i18n.language ===
                                                                            "he"
                                                                            ? "rtl"
                                                                            : "ltr",
                                                                },
                                                            }}
                                                        />
                                                    )}
                                                    dir={
                                                        i18n.language === "he"
                                                            ? "rtl"
                                                            : "ltr"
                                                    }
                                                    {...(i18n.language ===
                                                        "he" && {
                                                        "data-rtl": true,
                                                    })}
                                                />
                                                {validationErrors.locale && (
                                                    <Typography
                                                        variant="caption"
                                                        color="error"
                                                        sx={{
                                                            mt: 0.5,
                                                            ml: 1.5,
                                                        }}
                                                    >
                                                        {
                                                            validationErrors.locale
                                                        }
                                                    </Typography>
                                                )}
                                            </Box>

                                            {/* Empty Columns */}
                                            <Box
                                                sx={{
                                                    display: {
                                                        xs: "none",
                                                        md: "block",
                                                    },
                                                    gridColumn: {
                                                        md: "span 2",
                                                    },
                                                }}
                                            />
                                        </Box>

                                        {/* Second Row: Timezone */}
                                        <Box
                                            sx={{
                                                display: "grid",
                                                gridTemplateColumns: {
                                                    xs: "1fr",
                                                    md: "repeat(6, 1fr)",
                                                },
                                                gap: 3,
                                            }}
                                        >
                                            {/* Timezone Field */}
                                            <Box
                                                sx={{
                                                    gridColumn: {
                                                        md: "span 2",
                                                    },
                                                }}
                                            >
                                                <Autocomplete
                                                    fullWidth
                                                    options={Object.keys(
                                                        TimeZoneLabels
                                                    )}
                                                    value={
                                                        editedUser.time_zone ||
                                                        ""
                                                    }
                                                    onChange={(_, newValue) =>
                                                        handleFieldChange(
                                                            "time_zone",
                                                            newValue || ""
                                                        )
                                                    }
                                                    disabled={!isEditing}
                                                    getOptionLabel={(option) =>
                                                        TimeZoneLabels[
                                                        option
                                                        ] || option
                                                    }
                                                    renderOption={(
                                                        props,
                                                        option
                                                    ) => {
                                                        const {
                                                            key,
                                                            ...otherProps
                                                        } = props;
                                                        return (
                                                            <li
                                                                key={key}
                                                                {...otherProps}
                                                                style={{
                                                                    direction:
                                                                        i18n.language ===
                                                                            "he"
                                                                            ? "rtl"
                                                                            : "ltr",
                                                                    textAlign:
                                                                        i18n.language ===
                                                                            "he"
                                                                            ? "right"
                                                                            : "left",
                                                                    paddingRight:
                                                                        i18n.language ===
                                                                            "he"
                                                                            ? "16px"
                                                                            : "14px",
                                                                    paddingLeft:
                                                                        i18n.language ===
                                                                            "he"
                                                                            ? "14px"
                                                                            : "16px",
                                                                }}
                                                            >
                                                                <Typography
                                                                    sx={{
                                                                        direction:
                                                                            i18n.language ===
                                                                                "he"
                                                                                ? "rtl"
                                                                                : "ltr",
                                                                        textAlign:
                                                                            i18n.language ===
                                                                                "he"
                                                                                ? "right"
                                                                                : "left",
                                                                        width: "100%",
                                                                    }}
                                                                >
                                                                    {TimeZoneLabels[
                                                                        option
                                                                    ] || option}
                                                                </Typography>
                                                            </li>
                                                        );
                                                    }}
                                                    sx={{
                                                        "& .MuiAutocomplete-inputRoot":
                                                        {
                                                            direction:
                                                                i18n.language ===
                                                                    "he"
                                                                    ? "rtl"
                                                                    : "ltr",
                                                            "& .MuiAutocomplete-input":
                                                            {
                                                                textAlign:
                                                                    i18n.language ===
                                                                        "he"
                                                                        ? "right !important"
                                                                        : "left",
                                                                direction:
                                                                    i18n.language ===
                                                                        "he"
                                                                        ? "rtl !important"
                                                                        : "ltr",
                                                            },
                                                            "& input": {
                                                                textAlign:
                                                                    i18n.language ===
                                                                        "he"
                                                                        ? "right !important"
                                                                        : "left",
                                                                direction:
                                                                    i18n.language ===
                                                                        "he"
                                                                        ? "rtl !important"
                                                                        : "ltr",
                                                            },
                                                        },
                                                        "& .MuiAutocomplete-endAdornment":
                                                        {
                                                            right:
                                                                i18n.language ===
                                                                    "he"
                                                                    ? "auto"
                                                                    : undefined,
                                                            left:
                                                                i18n.language ===
                                                                    "he"
                                                                    ? theme.spacing(
                                                                        1.5
                                                                    )
                                                                    : "auto",
                                                        },
                                                    }}
                                                    renderInput={(params) => (
                                                        <TextField
                                                            {...params}
                                                            label={t(
                                                                "fields.timezone"
                                                            )}
                                                            required
                                                            {...(i18n.language ===
                                                                "he" && {
                                                                "data-hebrew": true,
                                                            })}
                                                            dir={
                                                                i18n.language ===
                                                                    "he"
                                                                    ? "rtl"
                                                                    : "ltr"
                                                            }
                                                            {...(i18n.language ===
                                                                "he" && {
                                                                "data-rtl": true,
                                                            })}
                                                            sx={{
                                                                "& .MuiInputBase-input":
                                                                {
                                                                    textAlign:
                                                                        i18n.language ===
                                                                            "he"
                                                                            ? "right"
                                                                            : "left",
                                                                    direction:
                                                                        i18n.language ===
                                                                            "he"
                                                                            ? "rtl"
                                                                            : "ltr",
                                                                },
                                                                "& .MuiInputLabel-root":
                                                                {
                                                                    textAlign:
                                                                        i18n.language ===
                                                                            "he"
                                                                            ? "right"
                                                                            : "left",
                                                                    direction:
                                                                        i18n.language ===
                                                                            "he"
                                                                            ? "rtl"
                                                                            : "ltr",
                                                                },
                                                            }}
                                                        />
                                                    )}
                                                    dir={
                                                        i18n.language === "he"
                                                            ? "rtl"
                                                            : "ltr"
                                                    }
                                                    {...(i18n.language ===
                                                        "he" && {
                                                        "data-rtl": true,
                                                    })}
                                                />
                                                {validationErrors.time_zone && (
                                                    <Typography
                                                        variant="caption"
                                                        color="error"
                                                        sx={{
                                                            mt: 0.5,
                                                            ml: 1.5,
                                                        }}
                                                    >
                                                        {
                                                            validationErrors.time_zone
                                                        }
                                                    </Typography>
                                                )}
                                            </Box>

                                            {/* Empty Columns */}
                                            <Box
                                                sx={{
                                                    display: {
                                                        xs: "none",
                                                        md: "block",
                                                    },
                                                    gridColumn: {
                                                        md: "span 4",
                                                    },
                                                }}
                                            />
                                        </Box>
                                    </CardContent>
                                </Card>

                                {/* Password Change Section - Only for own profile and not in view-as mode */}
                                {isOwnProfile && !isViewAsMode && (
                                    <Card
                                        elevation={0}
                                        sx={{
                                            borderRadius: theme.shape.borderRadius,
                                            border: "none",
                                            bgcolor: "transparent",
                                            boxShadow: "none",
                                        }}
                                    >
                                        <CardContent>
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 1,
                                                    mb: 2,
                                                }}
                                            >
                                                <LockIcon color="primary" />
                                                <Typography variant="h6">
                                                    {t("sections.password")}
                                                </Typography>
                                            </Box>
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent:
                                                        "space-between",
                                                    mb: 3,
                                                }}
                                            >
                                                <Typography
                                                    variant="body2"
                                                    color="text.secondary"
                                                >
                                                    {t(
                                                        "messages.password_security_info",
                                                        { ns: "users" }
                                                    )}
                                                </Typography>
                                                <Button
                                                    variant="outlined"
                                                    size="small"
                                                    className="cancel-button"
                                                    onClick={() =>
                                                        setPasswordDialogOpen(
                                                            true
                                                        )
                                                    }
                                                    disabled={isSaving}
                                                >
                                                    {t(
                                                        "actions.password_change_password",
                                                        { ns: "users" }
                                                    )}
                                                </Button>
                                            </Box>
                                        </CardContent>
                                    </Card>
                                )}
                            </Box>
                        </Box>

                        {/* Saving Backdrop */}
                        <Backdrop
                            sx={{
                                color: "#fff",
                                zIndex: (theme) => theme.zIndex.drawer + 1,
                                bgcolor: "rgba(0,0,0,0.5)",
                            }}
                            open={isSaving}
                        >
                            <Box
                                display="flex"
                                flexDirection="column"
                                alignItems="center"
                                gap={2}
                            >
                                <CircularProgress color="primary" size={40} />
                            </Box>
                        </Backdrop>

                        {/* Password Change Dialog */}
                        <ChangePasswordModal
                            open={passwordDialogOpen}
                            onClose={handlePasswordDialogClose}
                            userId={userId}
                        />
                    </Box>
                </Fade>
            </Box>
        </Box>
    );
};

export default UserDetails;
