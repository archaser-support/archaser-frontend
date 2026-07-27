"use client";

import {
    Box,
    CircularProgress,
    Link as MuiLink,
    Typography,
    useTheme,
} from "@mui/material";
import { GridColDef, GridSortModel } from "@mui/x-data-grid";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSession } from "next-auth/react";
import React, { useCallback, useMemo, useState } from "react";
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

export default function SecurityRolesList() {
    const { t, i18n } = useTranslation(["security_roles", "common"]);
    const { data: session } = useSession();
    const theme = useTheme();

    const accountId = session?.user?.account_id || 0;

    // Fetch roles
    const { data: rolesData, isLoading } = useQuery<{ roles: Role[] }>({
        queryKey: ["roles", accountId],
        queryFn: async () => {
            const response = await api.get("/roles");
            return response.data;
        },
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
                sortable: true,
                sortComparator: (v1, v2) => {
                    return (v1 || "").localeCompare(v2 || "");
                },
                renderCell: (params) => {
                    const role = params.row.role;
                    const locale =
                        i18n.language === "he" ? "he" : "en";
                    const roleHref = `/${locale}/app/settings/roles/${role}`;
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
                                sx={{
                                    fontWeight:
                                        theme.typography.fontWeightMedium,
                                }}
                            >
                                <Typography
                                    variant="body2"
                                    sx={{ color: "inherit" }}
                                >
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
                type: "number",
                sortable: true,
                sortComparator: (v1, v2) => {
                    const num1 =
                        typeof v1 === "number" ? v1 : parseInt(v1 || "0", 10);
                    const num2 =
                        typeof v2 === "number" ? v2 : parseInt(v2 || "0", 10);
                    return num1 - num2;
                },
            },
        ],
        [t, theme, i18n.language]
    );

    const [sortModel, setSortModel] = useState<GridSortModel>([
        {
            field: "roleDisplay",
            sort: "asc",
        },
    ]);

    const handleSortModelChange = useCallback((newSortModel: GridSortModel) => {
        setSortModel(newSortModel);
    }, []);

    // Sort rows based on sortModel (client-side sorting)
    const sortedRows: RoleRow[] = useMemo(() => {
        if (!sortModel || sortModel.length === 0) {
            return rows;
        }

        return [...rows].sort((a, b) => {
            for (const sortItem of sortModel) {
                const { field, sort } = sortItem;
                let comparison = 0;

                if (field === "roleDisplay") {
                    const aValue = a.roleDisplay || "";
                    const bValue = b.roleDisplay || "";
                    comparison = aValue.localeCompare(bValue);
                } else if (field === "permissionCount") {
                    const aValue = a.permissionCount || 0;
                    const bValue = b.permissionCount || 0;
                    comparison = aValue - bValue;
                }

                if (comparison !== 0) {
                    return sort === "desc" ? -comparison : comparison;
                }
            }
            return 0;
        });
    }, [rows, sortModel]);

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
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
            <EndlessScrollDataGrid
                rows={sortedRows}
                columns={columns}
                totalRecords={sortedRows.length}
                isLoading={isLoading}
                onLoadMore={() => {}}
                hasMore={false}
                sortModel={sortModel}
                onSortModelChange={handleSortModelChange}
                searchDirection={i18n.language === "he" ? "rtl" : "ltr"}
                language={i18n.language}
                fillViewport={true}
            />
        </Box>
    );
}
