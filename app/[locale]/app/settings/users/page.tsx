"use client";

import { PersonAdd, Person as PersonIcon } from "@mui/icons-material";
import { Box, IconButton, Tooltip, useTheme } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import api from "@/app/api";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import React from "react";
import { useTranslation } from "react-i18next";

import InternalPageWrapper from "@/components/InternalPageWrapper";
import PageHeader from "@/components/PageHeader";
import UserList from "@/shared/components/UserList";

const UsersPage: React.FC = () => {
    const { t, i18n } = useTranslation(["settings", "users"]);
    const router = useRouter();
    const theme = useTheme();
    const { data: session } = useSession();
    const accountId = session?.user?.account_id || 0;

    // Fetch user permissions
    const { data: userPermissionsData } = useQuery<{ permissions: string[] }>({
        queryKey: [
            "user-permissions",
            session?.user?.id,
            session?.user?.role,
            accountId,
        ],
        queryFn: async () => {
            const response = await api.get("/api/permissions/me");
            return response.data;
        },
        enabled: !!session?.user,
        staleTime: 2 * 60 * 1000, // Cache for 2 minutes
    });

    const userPermissions = userPermissionsData?.permissions || [];
    const hasManageUsersPermission = userPermissions.includes("manage_users");

    const handleCreateUser = () => {
        const locale = i18n.language === "he" ? "he" : "en";
        router.push(`/${locale}/app/settings/users/new`);
    };

    return (
        <InternalPageWrapper>
            <Box
                sx={{
                    bgcolor: "background.default",
                    borderRadius: theme.shape.borderRadius,
                }}
            >
                <PageHeader
                    title={t("actions.title", { ns: "users" }) || "Users Management"}
                    description={
                        t("actions.management_description", { ns: "users" }) ||
                        "Manage users and their permissions for your account."
                    }
                >
                    {hasManageUsersPermission && (
                        <Tooltip
                            title={
                                t("actions.add_user", { ns: "users" }) || "Add User"
                            }
                            arrow
                            enterDelay={300}
                            leaveDelay={100}
                            placement="bottom"
                            PopperProps={{
                                sx: {
                                    "& .MuiTooltip-tooltip": {
                                        direction:
                                            i18n.language === "he"
                                                ? "rtl"
                                                : "ltr",
                                    },
                                    "& .MuiTooltip-arrow": {
                                        ...(i18n.language === "he" && {
                                            transform: "scaleX(-1)",
                                        }),
                                    },
                                },
                            }}
                        >
                            <IconButton
                                color="primary"
                                size="small"
                                onClick={handleCreateUser}
                                className="toolbar-button"
                            >
                                <PersonAdd />
                            </IconButton>
                        </Tooltip>
                    )}
                </PageHeader>

                {/* Grid with height="auto" so fillViewport in EndlessScrollDataGrid sizes to viewport bottom (same as CustomerList) */}
                <UserList
                    variant="standalone"
                    showDescription={false}
                    height="auto"
                />
            </Box>
        </InternalPageWrapper>
    );
};

export default UsersPage;
