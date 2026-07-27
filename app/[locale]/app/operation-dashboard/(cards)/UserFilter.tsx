"use client";

import api from "@/app/api";
import { useSessionState } from "@/hooks/useSessionState";
import { ToolbarDropdownFilter } from "@/shared/components/ToolbarDropdownFilter";
import { getPastelColorForUser } from "@/utils/avatarUtils";
import { Person as PersonIcon } from "@mui/icons-material";
import {
    Avatar,
    Box,
    InputAdornment,
    Typography,
    useTheme,
} from "@mui/material";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

interface AgentOption {
    id: string;
    label: string;
    email?: string;
    image?: string | null;
}

interface UserFilterProps {
    selectedUserId: string | null;
    onUserChange: (userId: string | null) => void;
    businessUnitId?: number | null;
}

/** Wider than default toolbar pickers — agent names + avatars need room, especially in Hebrew RTL. */
const AGENT_FILTER_WIDTH_SPACING = 34;

const UserFilter: React.FC<UserFilterProps> = ({
    selectedUserId,
    onUserChange,
    businessUnitId = null,
}) => {
    const { t, i18n } = useTranslation(["dashboard"]);
    const { session } = useSessionState();
    const theme = useTheme();
    const [agents, setAgents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAgents = async () => {
            try {
                const accountId =
                    session?.user?.view_as_user_account_id ||
                    session?.user?.account_id;
                if (!accountId) return;

                const response = await api.get(
                    "/entities/users/collection-agents",
                    {
                        params: {
                            account_id: accountId,
                            ...(businessUnitId != null
                                ? { businessUnitId: String(businessUnitId) }
                                : {}),
                        },
                    }
                );
                setAgents(response.data || []);
            } catch (error) {
                console.error("Failed to fetch collection agents:", error);
            } finally {
                setLoading(false);
            }
        };

        if (session) {
            fetchAgents();
        }
    }, [session, businessUnitId]);

    const options = useMemo<AgentOption[]>(() => {
        const allAgentsOption: AgentOption = {
            id: "all",
            label: t("fields.all_agents"),
        };

        const agentOptions: AgentOption[] = agents.map((agent) => ({
            id: agent.id,
            label:
                agent.name ||
                `${agent.first_name || ""} ${agent.last_name || ""}`.trim() ||
                agent.email ||
                `Agent ${agent.id}`,
            email: agent.email,
            image: agent.image || null,
        }));

        return [allAgentsOption, ...agentOptions];
    }, [agents, t]);

    const selectedOption = useMemo(() => {
        if (!selectedUserId) {
            return options.find((opt) => opt.id === "all") || null;
        }
        return options.find((opt) => opt.id === selectedUserId) || null;
    }, [selectedUserId, options]);

    const isHebrew = i18n.language === "he";

    const toolbarStartAdornmentSx = useMemo(
        () => ({
            marginLeft: 0,
            marginRight: isHebrew ? 0 : theme.spacing(0.5),
            paddingLeft: isHebrew ? 0 : theme.spacing(1),
            paddingRight: isHebrew ? theme.spacing(1) : 0,
            minWidth: "auto",
            width: "auto",
        }),
        [theme, isHebrew]
    );

    const agentFilterSx = useMemo(
        () => ({
            minWidth: {
                xs: "100%",
                sm: theme.spacing(AGENT_FILTER_WIDTH_SPACING),
            },
            width: {
                xs: "100%",
                sm: theme.spacing(AGENT_FILTER_WIDTH_SPACING),
            },
            flexShrink: 0,
        }),
        [theme]
    );

    const startAdornment = (
        <>
            <InputAdornment position="start" sx={toolbarStartAdornmentSx}>
                <PersonIcon
                    sx={{
                        fontSize: "1.125rem",
                        color: "rgb(var(--primary-rgb))",
                    }}
                />
            </InputAdornment>
            {selectedOption && selectedOption.id !== "all" && (
                <InputAdornment position="start">
                    <Avatar
                        src={selectedOption.image || undefined}
                        sx={{
                            width: 20,
                            height: 20,
                            fontSize: "0.7rem",
                            bgcolor: getPastelColorForUser(selectedOption.id),
                            color: "#333",
                        }}
                    >
                        {selectedOption.label.charAt(0).toUpperCase()}
                    </Avatar>
                </InputAdornment>
            )}
        </>
    );

    return (
        <Box
            className="endless-scroll-toolbar"
            sx={{
                direction: isHebrew ? "rtl" : "ltr",
                flexShrink: 0,
            }}
        >
            <ToolbarDropdownFilter<AgentOption>
                value={selectedOption}
                onChange={(newValue) => {
                    if (!newValue || newValue.id === "all") {
                        onUserChange(null);
                    } else {
                        onUserChange(newValue.id);
                    }
                }}
                options={options}
                getOptionLabel={(option) => option.label}
                isOptionEqualToValue={(option, value) =>
                    option.id === value?.id
                }
                label={t("fields.toolbar_agent_label")}
                startAdornment={startAdornment}
                sx={agentFilterSx}
                loading={loading}
                disabled={loading}
                filterOptions={(opts, { inputValue }) => {
                    if (!inputValue) return opts;
                    const searchLower = inputValue.toLowerCase();
                    return opts.filter(
                        (option) =>
                            option.label.toLowerCase().includes(searchLower) ||
                            option.email?.toLowerCase().includes(searchLower)
                    );
                }}
                renderOption={(_props, option) => (
                    <>
                        <Avatar
                            src={option.image || undefined}
                            sx={{
                                width: 24,
                                height: 24,
                                fontSize: "0.75rem",
                                bgcolor:
                                    option.id !== "all"
                                        ? getPastelColorForUser(option.id)
                                        : undefined,
                                color:
                                    option.id !== "all" ? "#333" : undefined,
                            }}
                        >
                            {option.label.charAt(0).toUpperCase()}
                        </Avatar>
                        <Typography variant="body2">{option.label}</Typography>
                    </>
                )}
            />
        </Box>
    );
};

export default UserFilter;
