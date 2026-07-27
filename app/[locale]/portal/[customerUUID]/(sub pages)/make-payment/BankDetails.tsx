"use client";

import {
    AccountBalance as BankIcon,
    CheckCircle as CheckIcon,
    ContentCopy as CopyIcon,
} from "@mui/icons-material";
import {
    Box,
    Card,
    CardContent,
    Chip,
    Divider,
    IconButton,
    Tooltip,
    Typography
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { getPortalCardSx, PORTAL_CARD_CLASS } from "@/app/theme/portalCard";

interface BankDetailsProps {
    banks: {
        id: number;
        customer_bank_account_id: number;
        CustomerBankAccount: {
            id: number;
            bank_name: string | null;
            account_number: string | null;
            iban: string | null;
            swift: string | null;
            address_line1: string | null;
            city: string | null;
            postal_code: string | null;
            beneficiary_name: string | null;
            branch_name: string | null;
            branch_number: string | null;
            address_line2: string | null;
            Country: {
                iso2: string | null;
                name: string;
            } | null;
            comments: string | null;
        };
    }[];
}

export default function BankDetails({ banks }: BankDetailsProps) {
    const { i18n, t } = useTranslation(["bank_accounts", "portal", "common"]);
    const theme = useTheme();
    const [copiedField, setCopiedField] = useState<string | null>(null);

    const handleCopy = async (text: string, fieldName: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedField(fieldName);
            setTimeout(() => setCopiedField(null), 2000);
        } catch (err) {
            console.error("Failed to copy text: ", err);
        }
    };

    const BankCard = ({ bank, index }: { bank: any; index: number }) => {
        const account = bank.CustomerBankAccount;

        return (
            <Card
                key={bank.id}
                className={PORTAL_CARD_CLASS}
                elevation={0}
                sx={{
                    ...getPortalCardSx(theme),
                    mb: 2,
                    transition: "border-color 0.3s ease",
                    direction: i18n.language === "he" ? "rtl" : "ltr",
                    "&:hover": {
                        boxShadow: "none",
                        borderColor: "primary.main",
                    },
                }}
            >
                <CardContent sx={{ p: 3 }}>
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            mb: 2,
                        }}
                    >
                        <BankIcon color="primary" />
                        <Typography
                            variant="h6"
                            sx={{
                                fontWeight: 600,
                                color: (theme) => theme.palette.primary.main,
                                textAlign:
                                    i18n.language === "he" ? "right" : "left",
                                direction:
                                    i18n.language === "he" ? "rtl" : "ltr",
                            }}
                        >
                            {account.bank_name || t("fields.bank_name")}
                        </Typography>
                        {index === 0 && (
                            <Chip
                                label={t("fields.primary")}
                                size="small"
                                color="primary"
                                sx={{
                                    ml: i18n.language === "he" ? 0 : 1,
                                    mr: i18n.language === "he" ? 1 : 0,
                                    fontSize: "0.75rem",
                                }}
                            />
                        )}
                    </Box>

                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                            gap: 2,
                        }}
                    >
                        <Box sx={{ mb: 2 }}>
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{
                                    mb: 0.5,
                                    textAlign:
                                        i18n.language === "he"
                                            ? "right"
                                            : "left",
                                    direction:
                                        i18n.language === "he" ? "rtl" : "ltr",
                                }}
                            >
                                {t("fields.account_number")}
                            </Typography>
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                }}
                            >
                                <Typography
                                    variant="body1"
                                    sx={{
                                        fontFamily: "monospace",
                                        fontWeight: 500,
                                        textAlign:
                                            i18n.language === "he"
                                                ? "right"
                                                : "left",
                                        direction:
                                            i18n.language === "he"
                                                ? "rtl"
                                                : "ltr",
                                    }}
                                >
                                    {account.account_number || "N/A"}
                                </Typography>
                                <Tooltip title="Copy Account Number">
                                    <IconButton
                                        size="small"
                                        onClick={() =>
                                            handleCopy(
                                                account.account_number || "",
                                                `account-${bank.id}`
                                            )
                                        }
                                        sx={{
                                            color:
                                                copiedField ===
                                                    `account-${bank.id}`
                                                    ? "success.main"
                                                    : "primary.main",
                                        }}
                                    >
                                        {copiedField ===
                                            `account-${bank.id}` ? (
                                            <CheckIcon fontSize="small" />
                                        ) : (
                                            <CopyIcon fontSize="small" />
                                        )}
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        </Box>

                        <Box sx={{ mb: 2 }}>
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{
                                    mb: 0.5,
                                    textAlign:
                                        i18n.language === "he"
                                            ? "right"
                                            : "left",
                                    direction:
                                        i18n.language === "he" ? "rtl" : "ltr",
                                }}
                            >
                                {t("fields.beneficiary_name")}
                            </Typography>
                            <Typography
                                variant="body1"
                                sx={{
                                    fontWeight: 500,
                                    textAlign:
                                        i18n.language === "he"
                                            ? "right"
                                            : "left",
                                    direction:
                                        i18n.language === "he" ? "rtl" : "ltr",
                                }}
                            >
                                {account.beneficiary_name || "N/A"}
                            </Typography>
                        </Box>
                    </Box>

                    <Divider sx={{ my: 2 }} />

                        <Box
                            sx={{
                                display: "grid",
                                gridTemplateColumns: {
                                    xs: "1fr",
                                    sm: "1fr 1fr",
                                },
                                gap: 2,
                            }}
                        >
                            {account.iban && (
                                <Box sx={{ mb: 2 }}>
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                        sx={{
                                            mb: 0.5,
                                            textAlign:
                                                i18n.language === "he"
                                                    ? "right"
                                                    : "left",
                                            direction:
                                                i18n.language === "he"
                                                    ? "rtl"
                                                    : "ltr",
                                        }}
                                    >
                                        {t("fields.iban")}
                                    </Typography>
                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 1,
                                        }}
                                    >
                                        <Typography
                                            variant="body1"
                                            sx={{
                                                fontFamily: "monospace",
                                                fontWeight: 500,
                                                textAlign:
                                                    i18n.language === "he"
                                                        ? "right"
                                                        : "left",
                                                direction:
                                                    i18n.language === "he"
                                                        ? "rtl"
                                                        : "ltr",
                                            }}
                                        >
                                            {account.iban}
                                        </Typography>
                                        <Tooltip title="Copy IBAN">
                                            <IconButton
                                                size="small"
                                                onClick={() =>
                                                    handleCopy(
                                                        account.iban,
                                                        `iban-${bank.id}`
                                                    )
                                                }
                                                sx={{
                                                    color:
                                                        copiedField ===
                                                            `iban-${bank.id}`
                                                            ? "success.main"
                                                            : "primary.main",
                                                }}
                                            >
                                                {copiedField ===
                                                    `iban-${bank.id}` ? (
                                                    <CheckIcon fontSize="small" />
                                                ) : (
                                                    <CopyIcon fontSize="small" />
                                                )}
                                            </IconButton>
                                        </Tooltip>
                                    </Box>
                                </Box>
                            )}

                            {account.swift && (
                                <Box sx={{ mb: 2 }}>
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                        sx={{
                                            mb: 0.5,
                                            textAlign:
                                                i18n.language === "he"
                                                    ? "right"
                                                    : "left",
                                            direction:
                                                i18n.language === "he"
                                                    ? "rtl"
                                                    : "ltr",
                                        }}
                                    >
                                        {t("fields.swift")}
                                    </Typography>
                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 1,
                                        }}
                                    >
                                        <Typography
                                            variant="body1"
                                            sx={{
                                                fontFamily: "monospace",
                                                fontWeight: 500,
                                                textAlign:
                                                    i18n.language === "he"
                                                        ? "right"
                                                        : "left",
                                                direction:
                                                    i18n.language === "he"
                                                        ? "rtl"
                                                        : "ltr",
                                            }}
                                        >
                                            {account.swift}
                                        </Typography>
                                        <Tooltip title="Copy SWIFT Code">
                                            <IconButton
                                                size="small"
                                                onClick={() =>
                                                    handleCopy(
                                                        account.swift,
                                                        `swift-${bank.id}`
                                                    )
                                                }
                                                sx={{
                                                    color:
                                                        copiedField ===
                                                            `swift-${bank.id}`
                                                            ? "success.main"
                                                            : "primary.main",
                                                }}
                                            >
                                                {copiedField ===
                                                    `swift-${bank.id}` ? (
                                                    <CheckIcon fontSize="small" />
                                                ) : (
                                                    <CopyIcon fontSize="small" />
                                                )}
                                            </IconButton>
                                        </Tooltip>
                                    </Box>
                                </Box>
                            )}

                            {(account.branch_name || account.branch_number) && (
                                <Box sx={{ mb: 2 }}>
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                        sx={{
                                            mb: 0.5,
                                            textAlign:
                                                i18n.language === "he"
                                                    ? "right"
                                                    : "left",
                                            direction:
                                                i18n.language === "he"
                                                    ? "rtl"
                                                    : "ltr",
                                        }}
                                    >
                                        {t("fields.branch_name")}
                                    </Typography>
                                    <Typography
                                        variant="body1"
                                        sx={{
                                            fontWeight: 500,
                                            textAlign:
                                                i18n.language === "he"
                                                    ? "right"
                                                    : "left",
                                            direction:
                                                i18n.language === "he"
                                                    ? "rtl"
                                                    : "ltr",
                                        }}
                                    >
                                        {account.branch_name}{" "}
                                        {account.branch_number &&
                                            `(${account.branch_number})`}
                                    </Typography>
                                </Box>
                            )}

                            {account.Country && (
                                <Box sx={{ mb: 2 }}>
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                        sx={{
                                            mb: 0.5,
                                            textAlign:
                                                i18n.language === "he"
                                                    ? "right"
                                                    : "left",
                                            direction:
                                                i18n.language === "he"
                                                    ? "rtl"
                                                    : "ltr",
                                        }}
                                    >
                                        {t("fields.country", { ns: "common" })}
                                    </Typography>
                                    <Typography
                                        variant="body1"
                                        sx={{
                                            fontWeight: 500,
                                            textAlign:
                                                i18n.language === "he"
                                                    ? "right"
                                                    : "left",
                                            direction:
                                                i18n.language === "he"
                                                    ? "rtl"
                                                    : "ltr",
                                        }}
                                    >
                                        {account.Country.name}
                                    </Typography>
                                </Box>
                            )}
                        </Box>

                        {(account.address_line1 ||
                            account.city ||
                            account.postal_code) && (
                                <>
                                    <Divider sx={{ my: 2 }} />
                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "flex-start",
                                            gap: 1,
                                            mb: 2,
                                        }}
                                    >
                                        <Box>
                                            <Typography
                                                variant="body2"
                                                color="text.secondary"
                                                sx={{
                                                    mb: 0.5,
                                                    textAlign:
                                                        i18n.language === "he"
                                                            ? "right"
                                                            : "left",
                                                    direction:
                                                        i18n.language === "he"
                                                            ? "rtl"
                                                            : "ltr",
                                                }}
                                            >
                                                {t("sections.address")}
                                            </Typography>
                                            <Typography
                                                variant="body1"
                                                sx={{
                                                    fontWeight: 500,
                                                    textAlign:
                                                        i18n.language === "he"
                                                            ? "right"
                                                            : "left",
                                                    direction:
                                                        i18n.language === "he"
                                                            ? "rtl"
                                                            : "ltr",
                                                }}
                                            >
                                                {account.address_line1}
                                                {account.address_line2 && <br />}
                                                {account.address_line2}
                                                {(account.city ||
                                                    account.postal_code) && <br />}
                                                {account.city} {account.postal_code}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </>
                            )}

                        {account.comments && (
                            <>
                                <Divider sx={{ my: 2 }} />
                                <Box>
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                        sx={{
                                            mb: 0.5,
                                            textAlign:
                                                i18n.language === "he"
                                                    ? "right"
                                                    : "left",
                                            direction:
                                                i18n.language === "he"
                                                    ? "rtl"
                                                    : "ltr",
                                        }}
                                    >
                                        {t("sections.additional_info")}
                                    </Typography>
                                    <Typography
                                        variant="body1"
                                        sx={{
                                            fontStyle: "italic",
                                            textAlign:
                                                i18n.language === "he"
                                                    ? "right"
                                                    : "left",
                                            direction:
                                                i18n.language === "he"
                                                    ? "rtl"
                                                    : "ltr",
                                        }}
                                    >
                                        {account.comments}
                                    </Typography>
                                </Box>
                            </>
                        )}
                </CardContent>
            </Card>
        );
    };

    // Empty state
    if (banks.length === 0) {
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
                        ...getPortalCardSx(theme),
                        background:
                            "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
                        p: { xs: 3, sm: 4 },
                        direction: i18n.language === "he" ? "rtl" : "ltr",
                        width: "100%",
                        boxSizing: "border-box",
                    }}
                >
                    <BankIcon
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
                        {t("messages.no_accounts")}
                    </Typography>
                </Card>
            </Box>
        );
    }

    return (
        <Box>
            {banks.map((bank, index) => (
                <BankCard key={bank.id} bank={bank} index={index} />
            ))}
        </Box>
    );
}
