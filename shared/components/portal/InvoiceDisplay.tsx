"use client";
import {
    CalendarToday,
    ExpandLess,
    ExpandMore,
    Payment,
    Receipt,
    Warning
} from "@mui/icons-material";
import {
    Box,
    Card,
    CardContent,
    Checkbox,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tooltip,
    Typography
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
    getPortalCardExpandToggleSx,
    getPortalCardSx,
    PORTAL_CARD_CLASS,
} from "@/app/theme/portalCard";
import { useMobileDetection } from "@/shared/hooks/useMobileDetection";
import { portalInvoiceListRadius } from "@/shared/components/portal/portalInvoiceListStyles";
import { InvoiceDisplayProps, PortalInvoice } from "@/types/PortalInvoice";
import { formatDateForDisplay } from "@/utils/datetimeOperations";
import { formatAmountWithoutSymbol } from "@/utils/stringFormatters";

/**
 * Unified Invoice Display Component
 * Handles both read-only and selectable modes with responsive design
 */
export default function InvoiceDisplay({
    invoices,
    columns,
    isSelectable = false,
    selectedInvoices = new Set(),
    onInvoiceSelect,
    onSelectAll,
    showSelectAll = false,
    mobileBreakpoint = 768,
    emptyMessage,
}: InvoiceDisplayProps) {
    const { t, i18n } = useTranslation(["invoices", "portal", "common"]);
    const theme = useTheme();
    const portalCardSx = getPortalCardSx(theme);
    const portalCardBorder = theme.portalCard.border(theme);
    const isMobile = useMobileDetection(mobileBreakpoint);
    const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

    // Debug logging for RTL alignment

    const toggleCard = (invoiceId: string | number) => {
        const idString = String(invoiceId);
        const newExpanded = new Set(expandedCards);
        if (newExpanded.has(idString)) {
            newExpanded.delete(idString);
        } else {
            newExpanded.add(idString);
        }
        setExpandedCards(newExpanded);
    };

    // Mobile Card Design
    const renderMobileCard = (invoice: PortalInvoice, index: number) => {
        // Find the original amount field
        const originalAmountField = columns.find(
            (col) => col.key === "customerAmount"
        );
        const originalAmount = originalAmountField?.render
            ? originalAmountField.render(invoice)
            : invoice.customerAmount;

        // For mobile, use the rendered amount as-is from the column render function
        // This already includes the currency in the correct format
        let displayAmount;
        if (typeof originalAmount === "string") {
            displayAmount = originalAmount;
        } else if (typeof originalAmount === "number") {
            // Fallback if no render function
            const currency = invoice.customerCurrency || invoice.currency || "";
            const numericAmount = formatAmountWithoutSymbol(originalAmount);
            displayAmount = currency
                ? `${currency} ${numericAmount}`
                : `$${numericAmount}`;
        } else {
            // Fallback for other types
            displayAmount = String(originalAmount);
        }

        const isExpanded = expandedCards.has(String(invoice.id));

        return (
            <Card
                key={`${invoice.id}-${index}`}
                className={PORTAL_CARD_CLASS}
                elevation={0}
                sx={{
                    ...portalCardSx,
                    background:
                        "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
                    color: "#1a202c",
                    mb: 2,
                    overflow: "hidden",
                    position: "relative",
                }}
            >
                <CardContent
                    sx={{
                        position: "relative",
                        zIndex: 1,
                        p: 1,
                        direction: i18n.language === "he" ? "rtl" : "ltr",
                    }}
                >
                    {/* Header Section - Clickable */}
                    <Box
                        onClick={() => toggleCard(invoice.id)}
                        sx={{
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            flexDirection: "row", // Keep icon on the left always
                            mb: isExpanded ? 1 : 0,
                            p: 0.5,
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                        }}
                    >
                        {/* Invoice Info - RTL aware */}
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "flex-start",
                                flex: 1,
                                gap: 1,
                                flexDirection: "column",
                                justifyContent: "flex-start",
                            }}
                        >
                            {/* Invoice Number and Amount */}
                            <Box
                                sx={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 0.5,
                                    alignItems:
                                        i18n.language === "he"
                                            ? "flex-end"
                                            : "flex-start",
                                }}
                            >
                                {/* Invoice Number Row */}
                                <Box
                                    sx={{
                                        display: "flex",
                                        flexDirection: "row",
                                        gap: 0.5,
                                        alignItems: "center",
                                        justifyContent:
                                            i18n.language === "he"
                                                ? "flex-end"
                                                : "flex-start",
                                    }}
                                >
                                    {/* Selection checkbox - positioned to the right of the entire label+value for Hebrew */}
                                    {isSelectable && (
                                        <Checkbox
                                            checked={selectedInvoices.has(
                                                invoice.id
                                            )}
                                            onChange={(e) => {
                                                e.stopPropagation();
                                                onInvoiceSelect?.(invoice.id);
                                            }}
                                            sx={{
                                                color: "#64748b !important",
                                                margin: 0,
                                                padding: 0,
                                                marginTop: "2px",
                                                mr: i18n.language === "he" ? 0 : 1,
                                                ml: i18n.language === "he" ? 1 : 0,
                                                "&.Mui-checked": {
                                                    color: "#1a202c !important",
                                                },
                                            }}
                                        />
                                    )}

                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            flexDirection: "row",
                                            justifyContent: "flex-start",
                                            gap: 0.5,
                                        }}
                                    >
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                color: "#64748b",
                                                fontSize: "0.7rem",
                                                fontWeight: 500,
                                                textTransform: "uppercase",
                                                letterSpacing: "0.5px",
                                                lineHeight: 1,
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
                                            {t("fields.invoice_number")}:
                                        </Typography>
                                        <Typography
                                            variant="body1"
                                            sx={{
                                                fontWeight: 600,
                                                fontSize: "0.9rem",
                                                color: "#1a202c",
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
                                            {invoice.invoiceNumber}
                                        </Typography>
                                    </Box>
                                </Box>

                                {/* Original Amount Row - Below Invoice Number */}
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        flexDirection: "row",
                                        justifyContent:
                                            i18n.language === "he"
                                                ? "flex-end"
                                                : "flex-start",
                                        gap: 0.5,
                                    }}
                                >
                                    {/* Placeholder space to align with invoice number row */}
                                    {isSelectable && (
                                        <Box
                                            sx={{
                                                width: 24, // Same width as checkbox
                                                height: 24,
                                                mr: i18n.language === "he" ? 0 : 1,
                                                ml: i18n.language === "he" ? 1 : 0,
                                            }}
                                        />
                                    )}

                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            flexDirection: "row",
                                            justifyContent: "flex-start",
                                            gap: 0.5,
                                        }}
                                    >
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                color: "#64748b",
                                                fontSize: "0.7rem",
                                                fontWeight: 500,
                                                textTransform: "uppercase",
                                                letterSpacing: "0.5px",
                                                lineHeight: 1,
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
                                            {t("fields.amount")}:
                                        </Typography>
                                        <Typography
                                            variant="body1"
                                            sx={{
                                                fontWeight: 700,
                                                fontSize: "0.9rem",
                                                color: "#1a202c",
                                                direction: "ltr",
                                                textAlign: "left",
                                            }}
                                        >
                                            {displayAmount}
                                        </Typography>
                                    </Box>
                                </Box>
                            </Box>
                        </Box>

                        {/* Right side: Expand/Collapse Icon */}
                        <Box
                            sx={(theme) => getPortalCardExpandToggleSx(theme)}
                            aria-hidden
                        >
                            {isExpanded ? (
                                <ExpandLess fontSize="small" />
                            ) : (
                                <ExpandMore fontSize="small" />
                            )}
                        </Box>
                    </Box>

                    {/* Expanded Content */}
                    {isExpanded && (
                        <Box
                            sx={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 1,
                                animation: "slideDown 0.3s ease-in-out",
                                direction:
                                    i18n.language === "he" ? "rtl" : "ltr",
                                "@keyframes slideDown": {
                                    from: {
                                        opacity: 0,
                                        transform: "translateY(-10px)",
                                    },
                                    to: {
                                        opacity: 1,
                                        transform: "translateY(0)",
                                    },
                                },
                            }}
                        >
                            {(() => {
                                const filteredColumns = columns
                                    .filter(
                                        (col) =>
                                            col.key !== "invoiceNumber" &&
                                            col.key !== "customerAmount" &&
                                            col.key !== "currency" &&
                                            col.key !== "customerCurrency"
                                    )
                                    .sort(
                                        (a, b) =>
                                            (b.mobilePriority || 0) -
                                            (a.mobilePriority || 0)
                                    )
                                    .slice(0, 4);

                                return filteredColumns.map((col) => {
                                    let value = col.render
                                        ? col.render(invoice)
                                        : col.key === "dueDate"
                                            ? formatDateForDisplay(
                                                invoice[col.key],
                                                "date",
                                                i18n.language === "he" ? "he-IL" : "en-US"
                                            )
                                            : invoice[col.key];

                                    // Translate status values
                                    if (
                                        col.key === "status" &&
                                        typeof value === "string"
                                    ) {
                                        // Convert status to snake_case translation key
                                        const statusKey = value
                                            .toLowerCase()
                                            .replace(/\s+/g, "_");
                                        const translatedStatus = t(
                                            `values.invoice_status_${statusKey}`,
                                            { defaultValue: value }
                                        );
                                        value = translatedStatus;
                                    }

                                    const getIcon = (
                                        key: keyof PortalInvoice
                                    ) => {
                                        switch (key) {
                                            case "dueDate":
                                                return (
                                                    <CalendarToday
                                                        sx={{
                                                            fontSize: 20,
                                                            color: "#64748b",
                                                        }}
                                                    />
                                                );
                                            case "customerTotalPaid":
                                                return (
                                                    <Payment
                                                        sx={{
                                                            fontSize: 20,
                                                            color: "#64748b",
                                                        }}
                                                    />
                                                );
                                            case "customerOutstandingDebt":
                                                return (
                                                    <Warning
                                                        sx={{
                                                            fontSize: 20,
                                                            color: "#64748b",
                                                        }}
                                                    />
                                                );
                                            default:
                                                return null;
                                        }
                                    };

                                    return (
                                        <Box
                                            key={col.key}
                                            sx={{
                                                mb: 1,
                                                p: 1.5,
                                                backgroundColor:
                                                    "rgba(255,255,255,0.6)",
                                                borderRadius: "8px",
                                                border: "1px solid rgba(0,0,0,0.05)",
                                                direction:
                                                    i18n.language === "he"
                                                        ? "rtl"
                                                        : "ltr",
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    alignItems: "flex-start",
                                                    justifyContent:
                                                        "space-between",
                                                    flexDirection: "row", // Keep icon on the left always
                                                    gap: 1,
                                                }}
                                            >
                                                {/* Left side: Icon and Label */}
                                                <Box
                                                    sx={{
                                                        display: "flex",
                                                        alignItems:
                                                            "flex-start",
                                                        flex: 1,
                                                        gap: 1,
                                                        flexDirection:
                                                            i18n.language ===
                                                                "he"
                                                                ? "row-reverse"
                                                                : "row",
                                                        justifyContent:
                                                            i18n.language ===
                                                                "he"
                                                                ? "flex-end"
                                                                : "flex-start",
                                                    }}
                                                >
                                                    <Box
                                                        sx={{
                                                            display: "flex",
                                                            alignItems:
                                                                "center",
                                                            gap: 1,
                                                            flexDirection:
                                                                i18n.language ===
                                                                    "he"
                                                                    ? "row"
                                                                    : "row",
                                                        }}
                                                    >
                                                        {getIcon(col.key)}
                                                        <Typography
                                                            variant="body2"
                                                            sx={{
                                                                color: "#64748b",
                                                                fontSize:
                                                                    "0.7rem",
                                                                fontWeight: 500,
                                                                textTransform:
                                                                    "uppercase",
                                                                letterSpacing:
                                                                    "0.5px",
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
                                                            }}
                                                        >
                                                            {col.label}:
                                                        </Typography>
                                                    </Box>
                                                </Box>

                                                {/* Right side: Value */}
                                                <Box
                                                    sx={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        minWidth: 0,
                                                        flex: 1,
                                                        justifyContent:
                                                            i18n.language ===
                                                                "he"
                                                                ? "flex-end"
                                                                : "flex-start",
                                                    }}
                                                >
                                                    <Typography
                                                        variant="body2"
                                                        sx={{
                                                            color: "#1a202c",
                                                            fontWeight: 600,
                                                            fontSize: "0.8rem",
                                                            direction: (col.key === "customerAmount" || col.key === "customerTotalPaid" || col.key === "customerOutstandingDebt")
                                                                ? "ltr"
                                                                : (i18n.language === "he" ? "rtl" : "ltr"),
                                                            textAlign: (col.key === "customerAmount" || col.key === "customerTotalPaid" || col.key === "customerOutstandingDebt")
                                                                ? "left"
                                                                : (i18n.language === "he" ? "right" : "left"),
                                                            maxWidth: "100%",
                                                        }}
                                                    >
                                                        {value}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        </Box>
                                    );
                                });
                            })()}
                        </Box>
                    )}
                </CardContent>
            </Card>
        );
    };

    // Desktop Table Design
    const renderDesktopTable = () => (
        <TableContainer
            component={Paper}
            elevation={0}
            sx={{
                background:
                    "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%) !important",
                borderRadius: `${portalInvoiceListRadius} ${portalInvoiceListRadius} 0 0`,
                border: portalCardBorder,
                overflow: "hidden",
                direction: i18n.language === "he" ? "rtl" : "ltr",
                boxShadow: "none",
                backgroundImage: "none",
                "--Paper-shadow": "none",
            }}
        >
            <Table
                sx={{
                    direction: i18n.language === "he" ? "rtl" : "ltr",
                }}
            >
                <TableHead>
                    <TableRow
                        sx={{
                            background:
                                "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%) !important",
                            "& .MuiTableCell-root": {
                                color: "#1a202c !important",
                                fontWeight: 600,
                                backgroundColor: "transparent !important",
                                textAlign:
                                    i18n.language === "he" ? "right" : "left",
                            },
                            "& .MuiTableCell-root:first-of-type": {
                                borderTopLeftRadius:
                                    i18n.language === "he" ? 0 : portalInvoiceListRadius,
                                borderTopRightRadius:
                                    i18n.language === "he" ? portalInvoiceListRadius : 0,
                            },
                            "& .MuiTableCell-root:last-of-type": {
                                borderTopRightRadius:
                                    i18n.language === "he" ? 0 : portalInvoiceListRadius,
                                borderTopLeftRadius:
                                    i18n.language === "he" ? portalInvoiceListRadius : 0,
                            },
                        }}
                    >
                        {isSelectable && showSelectAll && (
                            <TableCell
                                sx={{
                                    direction:
                                        i18n.language === "he" ? "rtl" : "ltr",
                                    textAlign: "center",
                                    width: "48px",
                                    padding: "8px",
                                }}
                            >
                                <Checkbox
                                    title={t(
                                        "select_invoice"
                                    )}
                                    onChange={(e) =>
                                        onSelectAll?.(e.target.checked)
                                    }
                                    checked={
                                        selectedInvoices.size > 0 &&
                                        selectedInvoices.size ===
                                        invoices.length
                                    }
                                    sx={{
                                        color: "#64748b !important",
                                        "&.Mui-checked": {
                                            color: "#1a202c !important",
                                        },
                                    }}
                                />
                            </TableCell>
                        )}
                        {columns.map((col) => (
                            <TableCell
                                key={col.key}
                                sx={{
                                    direction:
                                        i18n.language === "he" ? "rtl" : "ltr",
                                    textAlign:
                                        i18n.language === "he"
                                            ? "right"
                                            : "left",
                                }}
                            >
                                {col.tooltip ? (
                                    <Tooltip
                                        title={col.tooltip}
                                        arrow
                                        placement="bottom"
                                    >
                                        <Box component="span">{col.label}</Box>
                                    </Tooltip>
                                ) : (
                                    col.label
                                )}
                            </TableCell>
                        ))}
                    </TableRow>
                </TableHead>
                <TableBody>
                    {invoices.length > 0 ? (
                        invoices.map((invoice, index) => (
                            <TableRow
                                key={invoice.id}
                                sx={{
                                    backgroundColor:
                                        index % 2 === 0
                                            ? "rgba(255, 255, 255, 0.8)"
                                            : "rgba(248, 250, 252, 0.8)",
                                    "&:hover": {
                                        backgroundColor:
                                            index % 2 === 0
                                                ? "rgba(255, 255, 255, 1)"
                                                : "rgba(248, 250, 252, 1)",
                                    },
                                }}
                            >
                                {isSelectable && (
                                    <TableCell
                                        sx={{
                                            direction:
                                                i18n.language === "he"
                                                    ? "rtl"
                                                    : "ltr",
                                            textAlign: "center",
                                            width: "48px",
                                            padding: "8px",
                                        }}
                                    >
                                        <Checkbox
                                            title={t(
                                                "select_invoice"
                                            )}
                                            onChange={() =>
                                                onInvoiceSelect?.(invoice.id)
                                            }
                                            checked={selectedInvoices.has(
                                                invoice.id
                                            )}
                                            sx={{
                                                color: "#64748b !important",
                                                "&.Mui-checked": {
                                                    color: "#1a202c !important",
                                                },
                                            }}
                                        />
                                    </TableCell>
                                )}
                                {columns.map((col) => (
                                    <TableCell
                                        key={col.key}
                                        sx={{
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
                                        {col.key === "status" ? (
                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    fontWeight: 600,
                                                    color:
                                                        invoice.status ===
                                                            "Due"
                                                            ? "secondary.main"
                                                            : "primary.main",
                                                }}
                                            >
                                                {invoice.status === "Overdue"
                                                    ? t("values.invoice_status_overdue")
                                                    : invoice.status === "Due"
                                                        ? t("values.invoice_status_due")
                                                        : invoice.status}
                                            </Typography>
                                        ) : col.render
                                            ? (() => {
                                                const renderedValue = col.render(invoice);
                                                const isAmountField = col.key === "customerAmount" || col.key === "customerTotalPaid" || col.key === "customerOutstandingDebt";

                                                if (isAmountField) {
                                                    return (
                                                        <Typography
                                                            component="span"
                                                            sx={{
                                                                direction: "ltr",
                                                                textAlign: "left",
                                                                display: "inline-block",
                                                            }}
                                                        >
                                                            {renderedValue}
                                                        </Typography>
                                                    );
                                                }

                                                return renderedValue;
                                            })()
                                            : col.key === "dueDate"
                                                ? formatDateForDisplay(
                                                    invoice[col.key],
                                                    "date",
                                                    i18n.language === "he" ? "he-IL" : "en-US"
                                                )
                                                : invoice[col.key]}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell
                                colSpan={
                                    columns.length + (isSelectable ? 1 : 0)
                                }
                                sx={{
                                    direction:
                                        i18n.language === "he" ? "rtl" : "ltr",
                                    textAlign:
                                        i18n.language === "he"
                                            ? "right"
                                            : "left",
                                }}
                            >
                                {emptyMessage ||
                                    t("no_invoices_found")}
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </TableContainer>
    );

    // Empty state
    if (invoices.length === 0) {
        return (
            <Box
                sx={{
                    width: "100%",
                    p: { xs: 2, sm: 4 },
                    textAlign: "center",
                    maxWidth: { xs: "90%", sm: 400 },
                    mx: "auto",
                    direction: i18n.language === "he" ? "rtl" : "ltr",
                    boxSizing: "border-box",
                }}
            >
                <Card
                    className={PORTAL_CARD_CLASS}
                    elevation={0}
                    sx={{
                        ...portalCardSx,
                        background:
                            "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
                        p: { xs: 3, sm: 4 },
                        direction: i18n.language === "he" ? "rtl" : "ltr",
                        width: "100%",
                        boxSizing: "border-box",
                    }}
                >
                    <Receipt
                        sx={{
                            fontSize: 48,
                            color: "#718096",
                            mb: 2,
                            opacity: 0.6,
                        }}
                    />
                    <Typography
                        variant="h6"
                        sx={{
                            color: "#4A5568",
                            fontWeight: 600,
                            mb: 1,
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                            textAlign: "center",
                        }}
                    >
                        {emptyMessage || t("no_invoices_found")}
                    </Typography>
                </Card>
            </Box>
        );
    }

    return (
        <Box
            sx={{
                direction: i18n.language === "he" ? "rtl" : "ltr",
            }}
        >
            {isMobile ? (
                <Box
                    sx={{
                        p: { xs: 1, sm: 2 },
                        width: "100%",
                        maxWidth: "100%",
                        direction: i18n.language === "he" ? "rtl" : "ltr",
                    }}
                >
                    {invoices && invoices.length > 0 ? (
                        invoices.map((invoice, index) =>
                            renderMobileCard(invoice, index)
                        )
                    ) : (
                        <Typography
                            variant="body1"
                            sx={{
                                textAlign:
                                    i18n.language === "he" ? "right" : "center",
                                color: "#718096",
                                direction:
                                    i18n.language === "he" ? "rtl" : "ltr",
                            }}
                        >
                            {t("no_invoices_found")}
                        </Typography>
                    )}
                </Box>
            ) : (
                renderDesktopTable()
            )}
        </Box>
    );
}
