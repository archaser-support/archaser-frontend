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
import { useSession } from "next-auth/react";

import EndlessScrollDataGrid, {
    useWindowWidth,
    BREAKPOINTS,
} from "@/shared/layout-components/grid/EndlessScrollDataGrid";
import {
    formatDateForDisplay,
    getUserDateLocale,
    getUserTimezone,
} from "@/utils/datetimeOperations";


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
        pageSize: number;
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
    const { data: session } = useSession();
    const userLocale = getUserDateLocale(session);
    const userTimezone = getUserTimezone(session);

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
                return <CheckCircleIcon fontSize="small" color="success" />;
            case "bounced":
            case "failed":
                return <ErrorIcon fontSize="small" color="error" />;
            case "sent":
                return <CheckCircleIcon fontSize="small" color="warning" />;
            case "scheduled":
                return <ScheduleIcon fontSize="small" color="info" />;
            default:
                return <HelpIcon fontSize="small" color="action" />;
        }
    };

    const columns: GridColDef[] = [
        {
            field: "sendingDateTime",
            headerName: "Sending Time",
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
                            Not scheduled
                        </Typography >
                    </Box >
                );

                const date = new Date(params.value);
                const formattedDate = formatDateForDisplay(date, "date", userLocale, userTimezone);
                const formattedTime = formatDateForDisplay(date, "time", userLocale, userTimezone);

                return (
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            height: "100%",
                            width: "100%",
                        }}
                    >
                        <Typography variant="body2">
                            {`${formattedDate} ${formattedTime}`}
                        </Typography>
                    </Box>
                );
            },
        },
        {
            field: "accountName",
            headerName: "Account Name",
            width: 180,
            renderCell: (params: any) => (
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        height: "100%",
                        width: "100%",
                    }}
                >
                    <Typography variant="body2" fontWeight="500">
                        {params.value}
                    </Typography>
                </Box>
            ),
        },
        {
            field: "customerCode",
            headerName: "Customer Code",
            width: 130,
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
                        {params.value}
                    </Typography>
                </Box>
            ),
        },
        {
            field: "emailType",
            headerName: `${channel} Type`,
            width: 150,
            renderCell: (params: any) => (
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        height: "100%",
                        width: "100%",
                    }}
                >
                    <Typography variant="body2">
                        {params.value}
                    </Typography>
                </Box>
            ),
        },
        {
            field: "recipientName",
            headerName: "Recipient Name",
            width: 150,
            renderCell: (params: any) => (
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        height: "100%",
                        width: "100%",
                    }}
                >
                    <Typography variant="body2">
                        {params.value}
                    </Typography>
                </Box>
            ),
        },
        {
            field: "recipientEmail",
            headerName: isEmailChannel ? "Recipient Email" : "Recipient Phone",
            width: 200,
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
                        {params.value}
                    </Typography>
                </Box>
            ),
        },
        {
            field: "deliveryStatus",
            headerName: "Delivery Status",
            width: 140,
            renderCell: (params: any) => (
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        height: "100%",
                        width: "100%",
                    }}
                >
                    <Chip
                        icon={getStatusIcon(params.value)}
                        label={params.value}
                        color={getStatusColor(params.value) as any}
                        size="small"
                        variant="outlined"
                    />
                </Box>
            ),
        },
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
