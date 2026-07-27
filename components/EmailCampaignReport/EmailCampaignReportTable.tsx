import {
    CheckCircle as CheckCircleIcon,
    Error as ErrorIcon,
    Visibility as VisibilityIcon,
    Mouse as MouseIcon,
    Schedule as ScheduleIcon,
    Help as HelpIcon,
} from "@mui/icons-material";
import {
    Box,
    Paper,
    Typography,
    Chip,
    Tooltip,
    IconButton,
    useTheme,
} from "@mui/material";
import { GridColDef } from "@mui/x-data-grid";
import React from "react";
import { useTranslation } from "react-i18next";
import { useDebounce } from "use-debounce";

import EndlessScrollDataGrid, {
    useWindowWidth,
    BREAKPOINTS,
} from "@/shared/layout-components/grid/EndlessScrollDataGrid";


interface EmailCampaignData {
    id: string;
    sendingDateTime: string;
    accountName: string;
    customerCode: string;
    emailType: string;
    deliveryStatus: string;
    clicked: boolean;
    opened: boolean;
    viewCount: number;
    openedTime?: string;
    clickedTime?: string;
    recipientEmail: string;
    recipientName: string;
}

interface EmailCampaignReportTableProps {
    data: EmailCampaignData[];
    pagination?: {
        page: number;
        limit: number;
        totalRecords: number;
        totalPages: number;
    };
    onPaginationChange?: (pagination: any) => void;
    channel?: "Email" | "SMS" | "WhatsApp";
}

const EmailCampaignReportTable: React.FC<EmailCampaignReportTableProps> = ({
    data,
    pagination,
    onPaginationChange,
    channel = "Email",
}) => {
    const windowWidth = useWindowWidth();
    const theme = useTheme();
    const { t, i18n } = useTranslation(["common"]);
    const [search, setSearch] = React.useState("");
    const [debouncedSearch] = useDebounce(search, 500);

    const isEmailChannel = channel === "Email";

    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case "delivered":
                return "success";
            case "bounced":
                return "error";
            case "failed":
                return "error";
            case "sent":
                return "warning";
            case "scheduled":
                return "info";
            default:
                return "default";
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status.toLowerCase()) {
            case "delivered":
                return <CheckCircleIcon color="success" />;
            case "bounced":
            case "failed":
                return <ErrorIcon color="error" />;
            case "sent":
                return <CheckCircleIcon color="warning" />;
            case "scheduled":
                return <ScheduleIcon color="info" />;
            default:
                return <HelpIcon color="action" />;
        }
    };

    const columns: GridColDef[] = [
        {
            field: "sendingDateTime",
            headerName: "Sending Date & Time",
            width: 180,
            renderCell: (params) => {
                if (!params.value) return (
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            height: "100%",
                            width: "100%",
                        }}
                    >
                        <Typography variant="body2" color="text.secondary">
                            Not scheduled
                        </Typography >
                    </Box >
                );

                const date = new Date(params.value);
                const formattedDate = date.toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                });
                const formattedTime = date.toLocaleTimeString('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                });

                return (
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            height: "100%",
                            width: "100%",
                        }}
                    >
                        <Typography variant="body2" color="text.secondary">
                            {`${formattedDate} ${formattedTime}`}
                        </Typography>
                    </Box>
                );
            },
        },
        {
            field: "accountName",
            headerName: "Account Name",
            width: 200,
            renderCell: (params) => (
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        height: "100%",
                        width: "100%",
                    }}
                >
                    <Tooltip title={`${params.value} (Code: ${params.row.customerCode})`}>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {params.value}
                        </Typography>
                    </Tooltip>
                </Box>
            ),
        },
        {
            field: "customerCode",
            headerName: "Customer Code",
            width: 130,
            renderCell: (params) => (
                <Typography variant="body2" color="text.secondary">
                    {params.value}
                </Typography>
            ),
        },
        {
            field: "emailType",
            headerName: "Template Category",
            width: 150,
            renderCell: (params) => {
                const getCategoryColor = (category: string) => {
                    switch (category) {
                        case "Automated":
                            return "primary";
                        case "Promise_to_pay":
                            return "success";
                        case "Dispute":
                            return "error";
                        case "Agent":
                            return "warning";
                        case "Legal":
                            return "info";
                        default:
                            return "default";
                    }
                };

                return (
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            height: "100%",
                            width: "100%",
                        }}
                    >
                        <Chip
                            label={
                                params.value === "Promise_to_pay"
                                    ? "Promise to Pay"
                                    : params.value
                            }
                            size="small"
                            variant="outlined"
                            color={getCategoryColor(params.value) as any}
                        />
                    </Box>
                );
            },
        },
        {
            field: "deliveryStatus",
            headerName: "Delivery Status",
            width: 140,
            renderCell: (params) => (
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        height: "100%",
                        width: "100%",
                    }}
                >
                    <Chip
                        label={params.value}
                        size="small"
                        color={getStatusColor(params.value) as any}
                        variant="outlined"
                    />
                </Box>
            ),
        },
        // Email-only columns: Times Viewed, Opened Time, Clicked Time
        ...(isEmailChannel ? [
            {
                field: "viewCount",
                headerName: "Times Viewed",
                width: 120,
                type: "number" as const,
                renderCell: (params: any) => (
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            height: "100%",
                            width: "100%",
                        }}
                    >
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {params.value}
                        </Typography>
                    </Box>
                ),
            },
            {
                field: "openedTime",
                headerName: "Opened Time",
                width: 160,
                renderCell: (params: any) => {
                    if (!params.value) return (
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                height: "100%",
                                width: "100%",
                            }}
                        >
                            <Typography variant="body2" color="text.secondary">
                                Not opened
                            </Typography>
                        </Box>
                    );

                    const date = new Date(params.value);
                    const formattedDate = date.toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                    });
                    const formattedTime = date.toLocaleTimeString('en-GB', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                    });

                    return (
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                height: "100%",
                                width: "100%",
                            }}
                        >
                            <Typography variant="body2" color="text.secondary">
                                {`${formattedDate} ${formattedTime}`}
                            </Typography>
                        </Box>
                    );
                },
            },
            {
                field: "clickedTime",
                headerName: "Clicked Time",
                width: 160,
                renderCell: (params: any) => {
                    if (!params.value) return (
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                height: "100%",
                                width: "100%",
                            }}
                        >
                            <Typography variant="body2" color="text.secondary">
                                Not clicked
                            </Typography>
                        </Box>
                    );

                    const date = new Date(params.value);
                    const formattedDate = date.toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                    });
                    const formattedTime = date.toLocaleTimeString('en-GB', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                    });

                    return (
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                height: "100%",
                                width: "100%",
                            }}
                        >
                            <Typography variant="body2" color="text.secondary">
                                {`${formattedDate} ${formattedTime}`}
                            </Typography>
                        </Box>
                    );
                },
            },
        ] : []),
        {
            field: "recipientName",
            headerName: "Recipient Name",
            width: 200,
            renderCell: (params: any) => {
                // For Email, show email; for SMS/WhatsApp, show mobile number
                const contactLabel = isEmailChannel ? "Email" : "Phone";
                const contactInfo = params.row.recipientEmail;

                return (
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            height: "100%",
                            width: "100%",
                        }}
                    >
                        <Tooltip title={`${params.row.recipientName} (${contactLabel}: ${contactInfo})`}>
                            <Typography
                                variant="body2"
                                sx={{
                                    maxWidth: 180,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {params.value}
                            </Typography>
                        </Tooltip>
                    </Box>
                );
            },
        },
        // For SMS/WhatsApp, add a column to show the phone number
        ...(!isEmailChannel ? [
            {
                field: "recipientPhone",
                headerName: "Recipient Phone",
                width: 160,
                renderCell: (params: any) => (
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            height: "100%",
                            width: "100%",
                        }}
                    >
                        <Typography variant="body2" color="text.secondary">
                            {params.row.recipientEmail}
                        </Typography>
                    </Box>
                ),
            },
        ] : []),
    ];

    // Add unique IDs to the data
    const dataWithIds = data.map((item, index) => ({
        ...item,
        id: `${item.sendingDateTime}-${item.recipientEmail}-${index}`,
    }));

    // Client-side search filtering
    const filteredRows = React.useMemo(() => {
        const term = debouncedSearch.trim().toLowerCase();
        if (!term) return dataWithIds;
        return dataWithIds.filter((row) => {
            const fields = [
                row.accountName,
                row.customerCode,
                row.emailType,
                row.deliveryStatus,
                row.recipientEmail,
                row.recipientName,
                row.sendingDateTime,
                row.openedTime || "",
                row.clickedTime || "",
                String(row.viewCount ?? ""),
            ];
            return fields.some((v) => String(v || "").toLowerCase().includes(term));
        });
    }, [dataWithIds, debouncedSearch]);

    // Get channel-specific table title
    const tableTitle = channel === "SMS" ? "SMS Campaign Data" :
        channel === "WhatsApp" ? "WhatsApp Campaign Data" :
            "Email Campaign Data";

    return (
        <Paper sx={{ p: theme.spacing(3) }}>
            <Box sx={{ display: "flex", alignItems: "center", mb: theme.spacing(2) }}>
                <Typography variant="h6" sx={{ flex: 1 }}>
                    {tableTitle}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {pagination ? `${pagination.totalRecords} total records` : `${data.length} records`}
                </Typography>
            </Box>

            <EndlessScrollDataGrid
                rows={filteredRows}
                columns={columns}
                totalRecords={filteredRows.length}
                isLoading={false}
                onLoadMore={() => { }}
                hasMore={false}
                searchValue={search}
                onSearchChange={setSearch}
                searchPlaceholder={t("common.search_placeholder", "Search...")}
                searchDebounceMs={500}
                searchDisabled={false}
                searchDirection={i18n.language === "he" ? "rtl" : "ltr"}
                language={i18n.language}
            />
        </Paper>
    );
};

export default EmailCampaignReportTable;
