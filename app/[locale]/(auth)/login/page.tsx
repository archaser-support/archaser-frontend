"use client";
import { apiFetch } from "@/utils/apiFetch";

import {
    ArrowForward,
    Google,
    Lock,
    Login as LoginIcon,
    Person,
    Visibility,
    VisibilityOff,
    Window,
} from "@mui/icons-material";
import {
    Alert,
    Box,
    CardContent,
    CircularProgress,
    Container,
    Divider,
    Fade,
    IconButton,
    InputAdornment,
    Menu,
    MenuItem,
    TextField,
    Typography,
    useMediaQuery,
    useTheme,
} from "@mui/material";
import { getSession, signIn } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import React, {
    useCallback,
    useEffect,
    useRef,
    useState
} from "react";
import { useTranslation } from "react-i18next";

import BackgroundPattern from "@/components/BackgroundPattern";
import i18nConfig from "@/i18nConfig";
import { createLogRecord } from "@/shared/utility/LogCreator";
import {
    getFirstAccessiblePage,
    isArchaserAdminAccount,
} from "@/shared/utils/navigation";
import AppUrls from "@/utils/appUrls";
import { getTenantSubdomain } from "@/utils/domainUtils";
import {
    clearNestAccessToken,
    getNestAzureStartUrl,
    getNestGoogleStartUrl,
    isNestAuthEnabled,
    nestAccountBySubdomain,
    nestCredentialsLogin,
    nestFetchMe,
    persistNestLoginProfile,
    restoreNestAccessToken,
    setNestAccessToken,
} from "@/utils/nestAuth";

import {
    AuthButton,
    AuthContainer,
    AuthHeaderSection,
    AuthIconContainer,
    AuthPaper,
} from "../components/AuthStyledComponents";

// Constants
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COOKIE_EXPIRY_DAYS = 30;
const FOCUS_DELAY = 100;

interface FormState {
    username: string;
    password: string;
    passwordShow: boolean;
    isLoading: boolean;
    loadingType: "login" | "microsoft" | "google" | null;
    error: string | null;
    usernameError: string;
    passwordError: string;
}



function LoginPageContent() {
    const { t, i18n } = useTranslation(["auth", "common"]);
    const searchParams = useSearchParams();

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));
    const usernameInputRef = useRef<HTMLInputElement>(null);
    const pendingNestTokenRef = useRef<string | null>(null);
    const nestTokenHandledRef = useRef(false);
    const isHebrew = i18n.language === "he";

    const [languageAnchor, setLanguageAnchor] = useState<null | HTMLElement>(
        null
    );

    const [formState, setFormState] = useState<FormState>({
        username: "",
        password: "",
        passwordShow: false,
        isLoading: false,
        loadingType: null,
        error: null,
        usernameError: "",
        passwordError: "",
    });

    // SSO state
    const [accountInfo, setAccountInfo] = useState<{
        accountId: number | null;
        name: string | null;
        ssoEnabled: boolean;
        ssoProviders: string[];
    } | null>(null);
    const [organizationError, setOrganizationError] = useState("");
    const [isLoadingAccount, setIsLoadingAccount] = useState(false);

    // Handle SSO Error from URL
    useEffect(() => {
        const error = searchParams?.get("error");
        if (error) {
            let errorMessage = t("messages.error");

            switch (error) {
                case "AccessDenied":
                    errorMessage = t("messages.sso_access_denied", { defaultValue: "Access denied. You do not have permission to sign in with this account." });
                    break;
                case "Configuration":
                    errorMessage = t("messages.sso_configuration_error", { defaultValue: "There is a problem with the server configuration." });
                    break;
                case "Verification":
                    errorMessage = t("messages.sso_verification_error", { defaultValue: "The sign in link is no longer valid." });
                    break;
                case "OAuthAccountNotLinked":
                    errorMessage = t("messages.sso_account_not_linked", { defaultValue: "To confirm your identity, sign in with the same account you used originally." });
                    break;
                case "AccountFrozen":
                    errorMessage = t("messages.account_frozen");
                    break;
                case "Inactive":
                    errorMessage = t("messages.account_inactive");
                    break;
                case "SSONotEnabled":
                    errorMessage = t("messages.sso_not_enabled", {
                        defaultValue: "SSO is not enabled for this organization.",
                    });
                    break;
                default:
                    errorMessage = t("messages.sso_generic_error", { defaultValue: "An error occurred during sign in." });
            }

            setFormState(prev => ({
                ...prev,
                error: errorMessage
            }));

            // Log the error
            createLogRecord(
                "ERROR",
                `SSO Login Callback Error: ${error}`,
                "Login",
                {
                    error: error,
                    action: "sso_callback_failed",
                    timestamp: new Date().toISOString(),
                }
            ).catch(() => { });
        }
    }, [searchParams, t]);

    // Handle Subdomain Logic
    useEffect(() => {
        if (typeof window !== 'undefined' && window.location.hostname.endsWith('.archaser.com')) {
            // Skips www/portal and deployment hosts such as dev.archaser.com,
            // none of which can belong to an account.
            const subdomain = getTenantSubdomain(window.location.hostname);
            if (subdomain) {
                handleOrganizationLookup(subdomain);
            }
        }
    }, []);

    // Focus the username field when component mounts
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (!searchParams?.get("error")) { // Only focus if no error, otherwise user might be reading error
                usernameInputRef.current?.focus();
            }
        }, FOCUS_DELAY);
        return () => {
            clearTimeout(timeoutId);
        };
    }, [searchParams]);

    const mapLanguageToLocale = useCallback(
        (language: string | undefined): string => {
            if (!language) return i18nConfig.defaultLocale;
            const langMap: Record<string, string> = {
                hebrew: "he",
                english: "en",
            };
            return langMap[language.toLowerCase()] || i18nConfig.defaultLocale;
        },
        []
    );

    const validateUsername = useCallback(
        (username: string): string => {
            if (!username.trim()) return t("messages.username_required");
            return "";
        },
        [t]
    );

    const validatePassword = useCallback(
        (password: string): string => {
            return password.trim() ? "" : t("messages.password_required");
        },
        [t]
    );

    const updateFormState = useCallback((updates: Partial<FormState>) => {
        setFormState((prev) => ({ ...prev, ...updates }));
    }, []);

    const handleUsernameChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const value = e.target.value;
            const usernameError = validateUsername(value);
            updateFormState({ username: value, usernameError });
        },
        [validateUsername, updateFormState]
    );

    // Handle SSO Init from Subdomain (Centralized Auth) - Defined here to access updateFormState
    useEffect(() => {
        const action = searchParams?.get("action");
        if (action === "sso_init") {
            const provider = searchParams?.get("provider");
            const returnTo = searchParams?.get("returnTo");

            if (provider && returnTo && (provider === "google" || provider === "azure-ad")) {
                // Show loading state
                updateFormState({
                    isLoading: true,
                    loadingType: provider === "azure-ad" ? "microsoft" : "google",
                    error: null,
                });

                if (isNestAuthEnabled()) {
                    window.location.href =
                        provider === "azure-ad"
                            ? getNestAzureStartUrl()
                            : getNestGoogleStartUrl();
                    return;
                }

                // Trigger sign in
                signIn(provider, {
                    callbackUrl: returnTo,
                    redirect: true,
                });
            }
        }
    }, [searchParams, updateFormState]);

    // Nest SSO / credentials return — bridge Nest JWT into NextAuth session
    useEffect(() => {
        const nestToken = searchParams?.get("nest_token");
        if (!nestToken || nestTokenHandledRef.current || !isNestAuthEnabled()) {
            return;
        }
        nestTokenHandledRef.current = true;
        pendingNestTokenRef.current = nestToken;
        setNestAccessToken(nestToken);

        const url = new URL(window.location.href);
        url.searchParams.delete("nest_token");
        window.history.replaceState({}, "", url.pathname + url.search);

        (async () => {
            updateFormState({ isLoading: true, loadingType: "login", error: null });
            try {
                const result = await signIn("credentials", {
                    nestAccessToken: nestToken,
                    redirect: false,
                });
                if (result?.error) {
                    clearNestAccessToken();
                    pendingNestTokenRef.current = null;
                    updateFormState({
                        error: t("messages.error"),
                        isLoading: false,
                        loadingType: null,
                    });
                    return;
                }

                const session = await getSession();
                if (!session) {
                    updateFormState({
                        error: t("messages.error"),
                        isLoading: false,
                        loadingType: null,
                    });
                    return;
                }

                if (typeof window !== "undefined") {
                    localStorage.clear();
                    sessionStorage.clear();
                    restoreNestAccessToken(pendingNestTokenRef.current);
                    const timestamp = Date.now().toString();
                    localStorage.setItem("freshLogin", "true");
                    localStorage.setItem("loginTimestamp", timestamp);
                    localStorage.setItem(
                        "loginUserId",
                        session?.user?.id || ""
                    );
                    localStorage.setItem(
                        "loginUserRole",
                        session?.user?.role || ""
                    );
                    localStorage.setItem(
                        "loginAccountId",
                        session?.user?.account_id?.toString() || ""
                    );
                }

                const language = mapLanguageToLocale(session?.user?.language);
                const date = new Date();
                date.setTime(
                    date.getTime() + COOKIE_EXPIRY_DAYS * 24 * 60 * 60 * 1000
                );
                document.cookie = `NEXT_LOCALE=${language};expires=${date.toUTCString()};path=/`;

                const isAdmin = isArchaserAdminAccount(
                    session?.user?.account_id
                );
                let redirectUrl: string;
                if (isAdmin) {
                    redirectUrl = AppUrls.ACCOUNTS;
                } else {
                    try {
                        const accountRes = await apiFetch(`/api/entities/accounts/${session?.user?.account_id}`,
                            { credentials: "include" }
                        );
                        const accountData = accountRes.ok
                            ? await accountRes.json()
                            : null;
                        const accountProducts = accountData
                            ? {
                                has_collection: accountData.has_collection,
                                has_credit_insurance:
                                    accountData.has_credit_insurance === true,
                            }
                            : undefined;
                        const permRes = await apiFetch("/api/permissions/me", {
                            credentials: "include",
                        });
                        const permData = permRes.ok
                            ? await permRes.json()
                            : null;
                        const permissions: string[] =
                            permData?.permissions ?? [];
                        redirectUrl = getFirstAccessiblePage(
                            permissions,
                            session?.user?.account_id ?? 0,
                            accountProducts
                        );
                    } catch {
                        redirectUrl = AppUrls.CUSTOMERS;
                    }
                }

                window.location.href = `/${language}${redirectUrl}`;
            } catch {
                clearNestAccessToken();
                pendingNestTokenRef.current = null;
                updateFormState({
                    error: t("messages.error"),
                    isLoading: false,
                    loadingType: null,
                });
            }
        })();
    }, [searchParams, t, updateFormState, mapLanguageToLocale]);

    const handlePasswordChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const value = e.target.value;
            const passwordError = validatePassword(value);
            updateFormState({ password: value, passwordError });
        },
        [validatePassword, updateFormState]
    );

    const handlePasswordLogin = useCallback(
        async (e: React.FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            updateFormState({ error: null, isLoading: true, loadingType: "login" });

            const usernameValidation = validateUsername(formState.username);
            const passwordValidation = validatePassword(formState.password);

            if (usernameValidation || passwordValidation) {
                updateFormState({
                    usernameError: usernameValidation,
                    passwordError: passwordValidation,
                    isLoading: false,
                    loadingType: null,
                });

                createLogRecord(
                    "WARNING",
                    `Login validation failed for user: ${formState.username}`,
                    "Login",
                    {
                        username: formState.username,
                        usernameError: usernameValidation,
                        passwordError: passwordValidation,
                        action: "form_validation_failed",
                        timestamp: new Date().toISOString(),
                    }
                ).catch(() => { });
                return;
            }

            try {
                let result;
                if (isNestAuthEnabled()) {
                    try {
                        const nestLogin = await nestCredentialsLogin(
                            formState.username,
                            formState.password
                        );
                        pendingNestTokenRef.current = nestLogin.access_token;
                        setNestAccessToken(nestLogin.access_token);
                        result = await signIn("credentials", {
                            nestAccessToken: nestLogin.access_token,
                            redirect: false,
                        });
                    } catch (nestError) {
                        const message =
                            nestError instanceof Error
                                ? nestError.message
                                : "Invalid credentials";
                        const errorType = message.toLowerCase().includes("frozen")
                            ? "account_frozen"
                            : message.toLowerCase().includes("inactive")
                                ? "account_inactive"
                                : "invalid_credentials";
                        createLogRecord(
                            "ERROR",
                            `Nest login failed for user: ${formState.username} - ${errorType}`,
                            "Login",
                            {
                                username: formState.username,
                                error: message,
                                action: "nest_authentication_failed",
                                errorType,
                                timestamp: new Date().toISOString(),
                            }
                        ).catch(() => { });
                        const errorMessage = message.toLowerCase().includes("frozen")
                            ? t("messages.account_frozen")
                            : message.toLowerCase().includes("inactive")
                                ? t("messages.account_inactive")
                                : t("messages.invalid_credentials");
                        updateFormState({
                            error: errorMessage,
                            isLoading: false,
                            loadingType: null,
                        });
                        return;
                    }
                } else {
                    result = await signIn("credentials", {
                        username: formState.username,
                        password: formState.password,
                        redirect: false,
                    });
                }

                if (result?.error) {
                    // Log authentication failure
                    const errorType = result.error
                        .toLowerCase()
                        .includes("frozen")
                        ? "account_frozen"
                        : result.error.toLowerCase().includes("inactive")
                            ? "account_inactive"
                            : result.error.toLowerCase().includes("magic link")
                                ? "magic_link_only"
                                : "invalid_credentials";

                    createLogRecord(
                        "ERROR",
                        `Login failed for user: ${formState.username} - ${errorType}`,
                        "Login",
                        {
                            username: formState.username,
                            error: result.error,
                            action: "authentication_failed",
                            errorType: errorType,
                            timestamp: new Date().toISOString(),
                        }
                    ).catch(() => { });

                    const errorMessage = result.error
                        .toLowerCase()
                        .includes("frozen")
                        ? t("messages.account_frozen")
                        : result.error.toLowerCase().includes("inactive")
                            ? t("messages.account_inactive")
                            : result.error.toLowerCase().includes("magic link")
                                ? t("messages.magic_link_only")
                                : t("messages.invalid_credentials");

                    updateFormState({ error: errorMessage, isLoading: false, loadingType: null });
                } else {
                    // Authentication successful - will log complete result after session is established

                    const session = await getSession();
                    if (session) {
                        // Clear React Query cache to prevent loading cached menu data
                        // Use localStorage to clear persisted cache data
                        if (typeof window !== "undefined") {
                            // Clear ALL localStorage to ensure complete cache clearing
                            localStorage.clear();

                            // Also clear sessionStorage for any cached session data
                            sessionStorage.clear();

                            // Re-store Nest JWT after clear (Stage 1A auth ownership)
                            restoreNestAccessToken(pendingNestTokenRef.current);

                            try {
                                const nestProfile = await nestFetchMe();
                                persistNestLoginProfile(nestProfile);
                            } catch {
                                // Session cookie bridge still works from JWT claims
                            }

                            // Add a flag to indicate fresh login
                            const timestamp = Date.now().toString();
                            localStorage.setItem("freshLogin", "true");
                            localStorage.setItem("loginTimestamp", timestamp);
                            localStorage.setItem(
                                "loginUserId",
                                session?.user?.id || ""
                            );
                            localStorage.setItem(
                                "loginUserRole",
                                session?.user?.role || ""
                            );
                            localStorage.setItem(
                                "loginAccountId",
                                session?.user?.account_id?.toString() || ""
                            );
                        }

                        const language = mapLanguageToLocale(
                            session?.user?.language
                        );
                        // Set cookie for next-i18n-router
                        const date = new Date();
                        date.setTime(
                            date.getTime() +
                            COOKIE_EXPIRY_DAYS * 24 * 60 * 60 * 1000
                        );
                        document.cookie = `NEXT_LOCALE=${language};expires=${date.toUTCString()};path=/`;

                        // Determine redirect URL based on role permissions
                        const isAdmin = isArchaserAdminAccount(
                            session?.user?.account_id
                        );
                        let redirectUrl: string;
                        if (isAdmin) {
                            redirectUrl = AppUrls.ACCOUNTS;
                        } else {
                            try {
                                const accountRes = await apiFetch(`/api/entities/accounts/${session?.user?.account_id}`,
                                    { credentials: "include" }
                                );
                                const accountData = accountRes.ok
                                    ? await accountRes.json()
                                    : null;
                                const accountProducts = accountData
                                    ? {
                                        has_collection:
                                            accountData.has_collection,
                                        has_credit_insurance:
                                            accountData.has_credit_insurance ===
                                            true,
                                    }
                                    : undefined;

                                const permRes = await apiFetch("/api/permissions/me",
                                    { credentials: "include" }
                                );
                                const permData =
                                    permRes.ok
                                        ? await permRes.json()
                                        : null;
                                const permissions: string[] =
                                    permData?.permissions ?? [];

                                redirectUrl = getFirstAccessiblePage(
                                    permissions,
                                    session?.user?.account_id ?? 0,
                                    accountProducts
                                );
                            } catch {
                                redirectUrl = AppUrls.CUSTOMERS;
                            }
                        }

                        const userName =
                            session?.user?.name ||
                            session?.user?.email ||
                            formState.username;
                        createLogRecord(
                            "INFO",
                            `User logged in successfully: ${userName}`,
                            "Login",
                            {
                                username: formState.username,
                                userName: userName,
                                userId: session?.user?.id,
                                language: language,
                                redirectUrl: `/${language}${redirectUrl}`,
                                userRole: session?.user?.role,
                                isAdmin: isAdmin,
                                action: "login_successful",
                                timestamp: new Date().toISOString(),
                            }
                        ).catch(() => { });

                        window.location.href = `/${language}${redirectUrl}`;
                    } else {
                        updateFormState({
                            error: "Failed to establish session. Please try again.",
                            isLoading: false,
                            loadingType: null,
                        });
                    }
                }
            } catch (error) {
                const errorMessage =
                    error instanceof Error ? error.message : "Unknown error";
                createLogRecord(
                    "ERROR",
                    `Login error for user: ${formState.username} - ${errorMessage}`,
                    "Login",
                    {
                        username: formState.username,
                        error: errorMessage,
                        action: "login_error",
                        timestamp: new Date().toISOString(),
                    }
                ).catch(() => { });
                updateFormState({
                    error: t("messages.error"),
                    isLoading: false,
                    loadingType: null,
                });
            }
        },
        [
            formState.username,
            formState.password,
            validateUsername,
            validatePassword,
            t,
            updateFormState,
            mapLanguageToLocale,
        ]
    );

    const handlePasswordVisibilityToggle = useCallback(() => {
        setFormState((prev) => ({ ...prev, passwordShow: !prev.passwordShow }));
    }, []);

    const handleLanguageClick = useCallback(
        (event: React.MouseEvent<HTMLElement>) => {
            setLanguageAnchor(event.currentTarget);
        },
        []
    );

    const handleLanguageClose = useCallback(() => {
        setLanguageAnchor(null);
    }, []);

    const handleLanguageChange = useCallback((language: string) => {
        setLanguageAnchor(null);
        const currentPath = window.location.pathname;
        const newPath = currentPath.replace(/^\/[a-z]{2}/, `/${language}`);
        const newUrl =
            window.location.origin + newPath + window.location.search;
        window.location.href = newUrl;
    }, []);

    // SSO Handlers
    const handleOrganizationLookup = useCallback(async (subdomain: string) => {
        if (!subdomain.trim()) {
            setAccountInfo(null);
            setOrganizationError("");
            return;
        }

        setIsLoadingAccount(true);
        setOrganizationError("");

        try {
            const data = await nestAccountBySubdomain(subdomain);
            if (!data) {
                setOrganizationError(t("messages.organization_not_found"));
                setAccountInfo(null);
                return;
            }
            setAccountInfo({
                accountId: data.accountId,
                name: data.name,
                ssoEnabled: data.ssoEnabled,
                ssoProviders: data.ssoProviders || [],
            });
        } catch (error) {
            console.error("Error fetching account:", error);
            setOrganizationError(t("messages.error"));
            setAccountInfo(null);
        } finally {
            setIsLoadingAccount(false);
        }
    }, [t]);



    const handleMicrosoftSSO = useCallback(async () => {
        if (!accountInfo?.accountId) {
            updateFormState({
                error: t("messages.organization_required_for_sso")
            });
            return;
        }

        updateFormState({
            isLoading: true,
            loadingType: "microsoft",
            error: null,
            usernameError: "",
            passwordError: ""
        });

        try {
            // Set cookie with account ID for validation in signIn callback
            document.cookie = `sso_account_id=${accountInfo.accountId};path=/;max-age=300`; // 5 min expiry

            // Check for subdomain and redirect to main domain if needed for Central Auth
            const mainUrlStr = process.env.NEXT_PUBLIC_BASE_URL;
            if (mainUrlStr && typeof window !== "undefined") {
                try {
                    const mainHostname = new URL(mainUrlStr).hostname;
                    const currentHostname = window.location.hostname;
                    // Skip if localhost or if we are already on the main domain
                    if (currentHostname !== "localhost" && currentHostname !== "127.0.0.1" && currentHostname !== mainHostname) {
                        const target = new URL("/login", mainUrlStr);
                        target.searchParams.set("action", "sso_init");
                        target.searchParams.set("provider", "azure-ad");
                        target.searchParams.set("returnTo", window.location.href);
                        window.location.href = target.toString();
                        return;
                    }
                } catch (e) {
                    console.error("Error checking domain:", e);
                }
            }

            if (isNestAuthEnabled()) {
                window.location.href = getNestAzureStartUrl();
                return;
            }

            await signIn("azure-ad", {
                redirect: true,
                callbackUrl: window.location.origin,
            });
        } catch (error) {
            console.error("Microsoft SSO error:", error);
            updateFormState({
                error: t("messages.microsoft_signin_error"),
                isLoading: false,
                loadingType: null,
            });
        }
    }, [accountInfo, t, updateFormState]);

    const handleGoogleSSO = useCallback(async () => {
        if (!accountInfo?.accountId) {
            updateFormState({
                error: t("messages.organization_required_for_sso")
            });
            return;
        }

        updateFormState({
            isLoading: true,
            loadingType: "google",
            error: null,
            usernameError: "",
            passwordError: ""
        });

        try {
            // Set cookie with account ID for validation in signIn callback
            document.cookie = `sso_account_id=${accountInfo.accountId};path=/;max-age=300`; // 5 min expiry

            // Check for subdomain and redirect to main domain if needed for Central Auth
            const mainUrlStr = process.env.NEXT_PUBLIC_BASE_URL;
            if (mainUrlStr && typeof window !== "undefined") {
                try {
                    const mainHostname = new URL(mainUrlStr).hostname;
                    const currentHostname = window.location.hostname;
                    // Skip if localhost or if we are already on the main domain
                    if (currentHostname !== "localhost" && currentHostname !== "127.0.0.1" && currentHostname !== mainHostname) {
                        const target = new URL("/login", mainUrlStr);
                        target.searchParams.set("action", "sso_init");
                        target.searchParams.set("provider", "google");
                        target.searchParams.set("returnTo", window.location.href);
                        window.location.href = target.toString();
                        return;
                    }
                } catch (e) {
                    console.error("Error checking domain:", e);
                }
            }

            if (isNestAuthEnabled()) {
                window.location.href = getNestGoogleStartUrl();
                return;
            }

            await signIn("google", {
                redirect: true,
                callbackUrl: window.location.origin,
            });
        } catch (error) {
            console.error("Google SSO error:", error);
            updateFormState({
                error: t("messages.google_signin_error"),
                isLoading: false,
                loadingType: null,
            });
        }
    }, [accountInfo, t, updateFormState]);

    const isLanguageMenuOpen = Boolean(languageAnchor);
    const currentLanguageText = isHebrew ? "עברית" : "English";

    return (
        <BackgroundPattern>
            {/* Language Switcher */}
            <Box
                sx={{
                    position: "absolute",
                    top: theme.spacing(4),
                    ...(isHebrew
                        ? { left: theme.spacing(2) }
                        : { right: theme.spacing(2) }),
                    zIndex: 10,
                    "@keyframes languageBounce": {
                        "0%": { transform: "translateY(0)" },
                        "10%": { transform: "translateY(0)" },
                        "20%": { transform: "translateY(-15px)" },
                        "30%": { transform: "translateY(-15px)" },
                        "40%": { transform: "translateY(0)" },
                        "50%": { transform: "translateY(0)" },
                        "60%": { transform: "translateY(-15px)" },
                        "70%": { transform: "translateY(-15px)" },
                        "80%": { transform: "translateY(0)" },
                        "100%": { transform: "translateY(0)" },
                    },
                }}
            >
                <IconButton
                    size="small"
                    onClick={handleLanguageClick}
                    sx={{
                        color: theme.palette.common.white,
                        backgroundColor: "rgba(255, 255, 255, 0.15)",
                        minHeight: `${theme.appButton.sizeSmall.height}px`,
                        height: `${theme.appButton.sizeSmall.height}px`,
                        // sx multiplies bare numbers by theme.shape.borderRadius (4) — use px; pill = height / 2
                        borderRadius: `${theme.appButton.sizeSmall.height / 2}px`,
                        padding: `${theme.appButton.sizeSmall.paddingY}px ${theme.spacing(theme.appButton.sizeSmall.paddingX)}`,
                        WebkitBackdropFilter: "blur(10px)",
                        backdropFilter: "blur(10px)",
                        animation: !isLanguageMenuOpen
                            ? "languageBounce 12s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite"
                            : "none",
                        "&:hover": {
                            backgroundColor: "rgba(255, 255, 255, 0.25)",
                        },
                    }}
                    aria-label="Change language"
                >
                    <Typography
                        variant="body2"
                        sx={{
                            fontWeight: theme.typography.fontWeightMedium,
                            fontSize: theme.typography.body2.fontSize,
                            color: theme.palette.common.white,
                        }}
                    >
                        {currentLanguageText}
                    </Typography>
                </IconButton>

                <Menu
                    anchorEl={languageAnchor}
                    open={isLanguageMenuOpen}
                    onClose={handleLanguageClose}
                    anchorOrigin={{
                        vertical: "bottom",
                        horizontal: isHebrew ? "left" : "right",
                    }}
                    transformOrigin={{
                        vertical: "top",
                        horizontal: isHebrew ? "left" : "right",
                    }}
                    PaperProps={{
                        sx: {
                            mt: 1,
                            minWidth: 120,
                            boxShadow: `0 8px 16px rgba(0,0,0,0.15)`,
                            // sx multiplies bare numbers by theme.shape.borderRadius (4) — use px
                            borderRadius: `${theme.appButton.borderRadius}px`,
                        },
                    }}
                >
                    <MenuItem
                        onClick={() => handleLanguageChange("en")}
                        selected={i18n.language === "en"}
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            direction: "ltr",
                        }}
                    >
                        English
                    </MenuItem>
                    <MenuItem
                        onClick={() => handleLanguageChange("he")}
                        selected={i18n.language === "he"}
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            direction: "rtl",
                        }}
                    >
                        עברית
                    </MenuItem>
                </Menu>
            </Box>

            <AuthContainer>
                <Container
                    maxWidth="xs"
                    sx={{
                        display: "flex",
                        justifyContent: "center",
                        direction: isHebrew ? "rtl" : "ltr",
                    }}
                >
                    <Fade in timeout={800}>
                        <AuthPaper
                            elevation={24}
                            dir={isHebrew ? "rtl" : "ltr"}
                        >
                            {/* Header Section */}
                            <AuthHeaderSection>
                                <AuthIconContainer>
                                    <LoginIcon
                                        sx={{
                                            fontSize: isMobile ? 30 : 40,
                                            transform: isHebrew
                                                ? "scaleX(-1)"
                                                : "none",
                                        }}
                                    />
                                </AuthIconContainer>
                                <Typography
                                    variant={
                                        isHebrew
                                            ? isMobile
                                                ? "hebrewSubtitle"
                                                : "hebrewTitle"
                                            : isMobile
                                                ? "h5"
                                                : "h4"
                                    }
                                    component="h1"
                                    sx={{
                                        fontWeight:
                                            theme.typography.fontWeightBold,
                                        mb: theme.spacing(1),
                                        textShadow: `0 2px 4px ${theme.palette.common.black}10`,
                                        position: "relative",
                                        zIndex: 1,
                                        color: theme.palette.primary
                                            .contrastText,
                                        textAlign: "center",
                                    }}
                                >
                                    {t("sections.login_title")}
                                </Typography>
                                <Typography
                                    variant={
                                        isHebrew ? "hebrewBodyText" : "body1"
                                    }
                                    sx={{
                                        opacity: 0.9,
                                        fontWeight:
                                            theme.typography.fontWeightRegular,
                                        position: "relative",
                                        zIndex: 1,
                                        fontSize: isMobile
                                            ? theme.typography.body2.fontSize
                                            : theme.typography.body1.fontSize,
                                        color: theme.palette.primary
                                            .contrastText,
                                        textAlign: "center",
                                    }}
                                >
                                    {t("sections.login_welcome_back")}
                                </Typography>
                            </AuthHeaderSection>

                            {/* Form Section */}
                            <CardContent
                                sx={{
                                    p: isMobile
                                        ? theme.spacing(3)
                                        : theme.spacing(4),
                                    direction: isHebrew ? "rtl" : "ltr",
                                }}
                            >
                                {formState.error && (
                                    <Alert
                                        severity="error"
                                        dir={isHebrew ? "rtl" : "ltr"}
                                        sx={{
                                            mb: theme.spacing(3),
                                            borderRadius:
                                                theme.shape.borderRadius,
                                            direction: isHebrew ? "rtl" : "ltr",
                                            textAlign: isHebrew
                                                ? "right"
                                                : "left",
                                            "& .MuiAlert-icon": {
                                                fontSize: 20,
                                            },
                                        }}
                                    >
                                        {formState.error}
                                    </Alert>
                                )}

                                {/* TEMPORARY: Debug SSO Testing - Only in Development */}
                                {process.env.NEXT_PUBLIC_DEBUGSSO === "true" ? (
                                    <Box
                                        sx={{
                                            mb: theme.spacing(3),
                                            p: 2,
                                            backgroundColor: "rgba(255, 193, 7, 0.1)",
                                            borderRadius: theme.shape.borderRadius,
                                            border: "2px dashed rgba(255, 193, 7, 0.5)",
                                        }}
                                    >
                                        <Typography variant="caption" color="warning.main" sx={{ mb: 1, display: "block", fontWeight: 600 }}>
                                            :wrench: DEBUG MODE: Test SSO Locally
                                        </Typography>
                                        <TextField
                                            fullWidth
                                            size="small"
                                            label="Organization Subdomain (for testing)"
                                            placeholder="e.g., acme"
                                            onChange={(e) => {
                                                const subdomain = e.target.value.trim();
                                                if (subdomain) {
                                                    handleOrganizationLookup(subdomain);
                                                } else {
                                                    setAccountInfo(null);
                                                    setOrganizationError("");
                                                }
                                            }}
                                            sx={{ mb: 1 }}
                                            helperText="Enter subdomain to load SSO options"
                                        />
                                        {isLoadingAccount && (
                                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
                                                <CircularProgress size={16} />
                                                <Typography variant="caption">Loading account...</Typography>
                                            </Box>
                                        )}
                                        {accountInfo && (
                                            <Alert severity="success" sx={{ mt: 1 }}>
                                                <Typography variant="caption">
                                                    ✓ Found: {accountInfo.name} (SSO: {accountInfo.ssoEnabled ? "Enabled" : "Disabled"})
                                                    {accountInfo.ssoProviders.length > 0 && ` - Providers: ${accountInfo.ssoProviders.join(", ")}`}
                                                </Typography>
                                            </Alert>
                                        )}
                                        {organizationError && (
                                            <Alert severity="error" sx={{ mt: 1 }}>
                                                <Typography variant="caption">{organizationError}</Typography>
                                            </Alert>
                                        )}
                                    </Box>
                                ) : null}


                                <Box
                                    component="form"
                                    onSubmit={handlePasswordLogin}
                                    noValidate
                                    sx={{
                                        direction: isHebrew ? "rtl" : "ltr",
                                    }}
                                >
                                    <TextField
                                        inputRef={usernameInputRef}
                                        fullWidth
                                        label={t("fields.username")}
                                        type="text"
                                        value={formState.username}
                                        onChange={handleUsernameChange}
                                        onBlur={() => {
                                            if (formState.username) {
                                                updateFormState({
                                                    usernameError: validateUsername(
                                                        formState.username
                                                    ),
                                                })
                                            } else {
                                                updateFormState({ usernameError: "" })
                                            }
                                        }}
                                        dir={isHebrew ? "rtl" : "ltr"}
                                        {...(isHebrew && {
                                            "data-hebrew": true,
                                        })}
                                        sx={{
                                            mb: theme.spacing(3),
                                            "& .MuiInputBase-root": {
                                                direction: isHebrew
                                                    ? "rtl"
                                                    : "ltr",
                                            },
                                            "& .MuiFormHelperText-root": {
                                                textAlign: isHebrew
                                                    ? "right"
                                                    : "left",
                                            },
                                            "& .MuiInputLabel-root": {
                                                transform: isHebrew
                                                    ? "translate(0px, -9px) scale(0.75) !important"
                                                    : "translate(14px, -9px) scale(0.75) !important",
                                                "&.MuiInputLabel-shrink": {
                                                    transform: isHebrew
                                                        ? "translate(0px, -9px) scale(0.75) !important"
                                                        : "translate(14px, -9px) scale(0.75) !important",
                                                },
                                            },
                                        }}
                                        variant="outlined"
                                        InputLabelProps={{ shrink: true }}
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <Person color="primary" />
                                                </InputAdornment>
                                            ),
                                        }}
                                        error={!!formState.usernameError}
                                        helperText={formState.usernameError}
                                        inputProps={{
                                            "aria-describedby": "username-error",
                                        }}
                                    />

                                    <TextField
                                        fullWidth
                                        label={t("fields.password")}
                                        type={
                                            formState.passwordShow
                                                ? "text"
                                                : "password"
                                        }
                                        value={formState.password}
                                        onChange={handlePasswordChange}
                                        onBlur={() => {
                                            const passwordError =
                                                validatePassword(
                                                    formState.password
                                                );
                                            updateFormState({ passwordError });
                                        }}
                                        dir={isHebrew ? "rtl" : "ltr"}
                                        {...(isHebrew && {
                                            "data-hebrew": true,
                                        })}
                                        sx={{
                                            mb: theme.spacing(2),
                                            "& .MuiInputBase-root": {
                                                direction: isHebrew
                                                    ? "rtl"
                                                    : "ltr",
                                            },
                                            "& .MuiFormHelperText-root": {
                                                textAlign: isHebrew
                                                    ? "right"
                                                    : "left",
                                            },
                                            "& .MuiInputLabel-root": {
                                                transform: isHebrew
                                                    ? "translate(0px, -9px) scale(0.75) !important"
                                                    : "translate(14px, -9px) scale(0.75) !important",
                                                "&.MuiInputLabel-shrink": {
                                                    transform: isHebrew
                                                        ? "translate(0px, -9px) scale(0.75) !important"
                                                        : "translate(14px, -9px) scale(0.75) !important",
                                                },
                                            },
                                            "& .MuiInputAdornment-positionStart":
                                            {
                                                paddingRight: isHebrew
                                                    ? 0
                                                    : undefined,
                                                marginRight: isHebrew
                                                    ? 0
                                                    : undefined,
                                                "& .MuiSvgIcon-root": {
                                                    marginRight: isHebrew
                                                        ? 0
                                                        : undefined,
                                                },
                                            },
                                        }}
                                        variant="outlined"
                                        InputLabelProps={{ shrink: true }}
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment
                                                    position="start"
                                                    sx={{
                                                        mr: isHebrew
                                                            ? 0
                                                            : undefined,
                                                        pr: isHebrew
                                                            ? 0
                                                            : undefined,
                                                    }}
                                                >
                                                    <Lock color="primary" />
                                                </InputAdornment>
                                            ),
                                            endAdornment: (
                                                <InputAdornment position="end">
                                                    <IconButton
                                                        onClick={
                                                            handlePasswordVisibilityToggle
                                                        }
                                                        edge={
                                                            isHebrew
                                                                ? "start"
                                                                : "end"
                                                        }
                                                        aria-label="toggle password visibility"
                                                        sx={{
                                                            ml: isHebrew
                                                                ? theme.spacing(
                                                                    1
                                                                )
                                                                : 0,
                                                            mr: isHebrew
                                                                ? 0
                                                                : theme.spacing(
                                                                    1
                                                                ),
                                                        }}
                                                    >
                                                        {formState.passwordShow ? (
                                                            <VisibilityOff />
                                                        ) : (
                                                            <Visibility />
                                                        )}
                                                    </IconButton>
                                                </InputAdornment>
                                            ),
                                        }}
                                        error={!!formState.passwordError}
                                        helperText={formState.passwordError}
                                        inputProps={{
                                            "aria-describedby":
                                                "password-error",
                                        }}
                                    />

                                    <Box
                                        sx={{
                                            display: "flex",
                                            direction: isHebrew ? "rtl" : "ltr",
                                            justifyContent: isHebrew
                                                ? "flex-end"
                                                : "flex-end",
                                            mb: theme.spacing(3),
                                        }}
                                    >
                                        <Box
                                            component={Link}
                                            href="/forget-password"
                                            sx={{
                                                color: theme.palette.primary
                                                    .main,
                                                textDecoration: "none",
                                                fontSize:
                                                    theme.typography.body2
                                                        .fontSize,
                                                fontWeight:
                                                    theme.typography
                                                        .fontWeightMedium,
                                                transition: "color 0.2s ease",
                                                textAlign: isHebrew
                                                    ? "left"
                                                    : "right",
                                                "&:hover": {
                                                    color: theme.palette.primary
                                                        .dark,
                                                },
                                            }}
                                        >
                                            {t("actions.forgot_password")}
                                        </Box>
                                    </Box>

                                    <AuthButton
                                        type="submit"
                                        fullWidth
                                        variant="contained"
                                        disabled={formState.isLoading}
                                        sx={{
                                            direction: isHebrew ? "rtl" : "ltr",
                                            background: formState.isLoading
                                                ? `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.secondary.dark} 100%)`
                                                : `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                                            boxShadow: formState.isLoading
                                                ? `0 2px 8px ${theme.palette.primary.main}30`
                                                : `0 4px 12px ${theme.palette.primary.main}40`,
                                            cursor: formState.isLoading
                                                ? "not-allowed"
                                                : "pointer",
                                            "&:hover": {
                                                background: formState.isLoading
                                                    ? `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.secondary.dark} 100%)`
                                                    : `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.secondary.dark} 100%)`,
                                                transform: formState.isLoading
                                                    ? "none"
                                                    : "translateY(-2px)",
                                                boxShadow: formState.isLoading
                                                    ? `0 2px 8px ${theme.palette.primary.main}30`
                                                    : `0 8px 25px ${theme.palette.primary.main}60`,
                                            },
                                            "&:active": {
                                                transform: formState.isLoading
                                                    ? "none"
                                                    : "translateY(0)",
                                                boxShadow: formState.isLoading
                                                    ? `0 2px 8px ${theme.palette.primary.main}30`
                                                    : `0 4px 12px ${theme.palette.primary.main}40`,
                                            },
                                            "&:disabled": {
                                                background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.secondary.dark} 100%)`,
                                                transform: "none",
                                                boxShadow: `0 2px 8px ${theme.palette.primary.main}30`,
                                                opacity: 0.8,
                                            },
                                        }}
                                    >
                                        {formState.isLoading && formState.loadingType === "login"
                                            ? t("messages.logging_in")
                                            : t("actions.login")}
                                    </AuthButton>
                                </Box>

                                <Box sx={{ mb: theme.spacing(3) }} />

                                {/* SSO Buttons Section */}
                                {
                                    accountInfo?.ssoEnabled &&
                                    accountInfo.ssoProviders.length > 0 && (
                                        <Box sx={{ mb: theme.spacing(2) }}>
                                            <Divider sx={{ my: 2, color: "text.secondary" }}>
                                                {t("common.or", { defaultValue: "OR" })}
                                            </Divider>

                                            {/* Microsoft SSO Button */}
                                            {(accountInfo.ssoProviders.includes("microsoft")) && (
                                                <AuthButton
                                                    fullWidth
                                                    type="button"
                                                    variant="outlined"
                                                    onClick={handleMicrosoftSSO}
                                                    disabled={formState.isLoading}
                                                    startIcon={<Window />}
                                                    sx={{
                                                        direction: isHebrew ? "rtl" : "ltr",
                                                        mb: theme.spacing(2),
                                                        borderColor: "#00A4EF",
                                                        color: "#00A4EF",
                                                        background: "transparent",
                                                        "&:hover": {
                                                            borderColor: "#0078D4",
                                                            background: "rgba(0, 120, 212, 0.04)",
                                                        },
                                                    }}
                                                    endIcon={
                                                        <ArrowForward
                                                            sx={{
                                                                transition: "transform 0.2s ease",
                                                                transform: isHebrew ? "rotate(180deg)" : "none",
                                                            }}
                                                        />
                                                    }
                                                >
                                                    {t("actions.sign_in_with_microsoft")}
                                                </AuthButton>
                                            )}

                                            {/* Google SSO Button */}
                                            {accountInfo.ssoProviders.includes("google") && (
                                                <AuthButton
                                                    fullWidth
                                                    type="button"
                                                    variant="outlined"
                                                    onClick={handleGoogleSSO}
                                                    disabled={formState.isLoading}
                                                    startIcon={<Google />}
                                                    sx={{
                                                        direction: isHebrew ? "rtl" : "ltr",
                                                        mb: theme.spacing(2),
                                                        borderColor: "#4285F4",
                                                        color: "#4285F4",
                                                        background: "transparent",
                                                        "&:hover": {
                                                            borderColor: "#357AE8",
                                                            background: "rgba(66, 133, 244, 0.04)",
                                                        },
                                                    }}
                                                    endIcon={
                                                        <ArrowForward
                                                            sx={{
                                                                transition: "transform 0.2s ease",
                                                                transform: isHebrew ? "rotate(180deg)" : "none",
                                                            }}
                                                        />
                                                    }
                                                >
                                                    {t("actions.sign_in_with_google")}
                                                </AuthButton>
                                            )}
                                        </Box>
                                    )
                                }
                            </CardContent>
                        </AuthPaper>
                    </Fade>
                </Container>
            </AuthContainer>
        </BackgroundPattern>
    );
}

export default function LoginPage() {
    // Login page uses translations from the layout's TranslationsProvider
    // No need to initialize translations here as they're already provided by the root layout

    return (
        <React.Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><CircularProgress /></Box>}>
            <LoginPageContent />
        </React.Suspense>
    );
}
