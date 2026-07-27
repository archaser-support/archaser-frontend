"use client";

import {
    Box,
    CircularProgress,
    Link as MuiLink,
    Typography,
} from "@mui/material";
import { GridColDef, GridSortModel } from "@mui/x-data-grid";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import api from "@/app/api";
import EndlessScrollDataGrid from "@/shared/layout-components/grid/EndlessScrollDataGrid";

interface Role {
    role: string;
    permissionCount: number;
}

interface RoleRow {
    id: string;
    role: string;
    roleDisplay: string;
    permissionCount: number;
}

interface AccountRolesProps {
    accountId: number | string;
}

export default function AccountRoles({ accountId }: AccountRolesProps) {
    const { t } = useTranslation(["security_roles", "common"]);
    const targetAccountId =
        typeof accountId === "string" ? parseInt(accountId, 10) : accountId;

    // Fetch roles
    const { data: rolesData, isLoading } = useQuery<{ roles: Role[] }>({
        queryKey: ["roles", targetAccountId],
        queryFn: async () => {
            const response = await api.get("/roles", {
                params: { accountId: targetAccountId },
            });
            return response.data;
        },
        enabled: !isNaN(targetAccountId) && targetAccountId > 0,
        staleTime: 2 * 60 * 1000, // Cache for 2 minutes
    });

    // Transform roles data for the grid
    const rows: RoleRow[] = useMemo(() => {
        if (!rolesData?.roles) return [];
        return rolesData.roles.map((role) => ({
            id: role.role,
            role: role.role,
            roleDisplay: t(`values.${role.role}`, {
                ns: "security_roles",
                defaultValue: role.role,
            }),
            permissionCount: role.permissionCount,
        }));
    }, [rolesData, t]);

    // Define columns
    const columns: GridColDef<RoleRow>[] = useMemo(
        () => [
            {
                field: "roleDisplay",
                headerName: t("fields.role_name", { ns: "security_roles" }),
                flex: 1,
                minWidth: 200,
                renderCell: (params) => {
                    const role = params.row.role;
                    const roleHref = `/app/settings/roles/${role}?accountId=${targetAccountId}`;
                    return (
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                height: "100%",
                                width: "100%",
                            }}
                        >
                            <MuiLink
                                component={Link}
                                href={roleHref}
                                onClick={(e) => {
                                    e.stopPropagation();
                                }}
                            >
                                <Typography variant="body2" sx={{ color: "inherit" }}>
                                    {params.value}
                                </Typography>
                            </MuiLink>
                        </Box>
                    );
                },
            },
            {
                field: "permissionCount",
                headerName: t("fields.permission_count", {
                    ns: "security_roles",
                }),
                width: 200,
                align: "center",
                headerAlign: "center",
            },
        ],
        [t, targetAccountId]
    );

    const sortModel: GridSortModel = useMemo(
        () => [
            {
                field: "roleDisplay",
                sort: "asc",
            },
        ],
        []
    );

    if (isLoading) {
        return (
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "100%",
                }}
            >
                <CircularProgress color="primary" />
            </Box>
        );
    }

    return (
        <Box
            sx={{
                width: "100%",
                display: "flex",
                flexDirection: "column",
                minHeight: "500px",
            }}
        >
            <Box sx={{ flex: 1, minHeight: "500px", display: "flex", flexDirection: "column" }}>
                <EndlessScrollDataGrid
                    rows={rows}
                    columns={columns}
                    totalRecords={rows.length}
                    isLoading={isLoading}
                    onLoadMore={() => { }}
                    hasMore={false}
                    sortModel={sortModel}
                    fillViewport={true}
                />
            </Box>
        </Box>
    );
}
