"use client";

import { Box, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import DeleteDialog from "@/shared/layout-components/modal/DeleteDialog";

interface MakePaymentModalProps {
    isOpen: boolean;
    setIsOpen: (val: boolean) => void;
    accountId: number | null;
    customerId: number | null;
    customer?: any; // Customer data
    onPaymentInitiated?: () => void;
}

const MakePaymentModal: React.FC<MakePaymentModalProps> = ({
    isOpen,
    setIsOpen,
    accountId: _accountId,
    customerId: _customerId,
    customer,
    onPaymentInitiated,
}) => {
    const { t, i18n } = useTranslation(["customers", "common"]);
    const theme = useTheme();
    const [bankDetails, setBankDetails] = useState<string | null>(null);

    const getBankDetails = () => {
        if (!customer) {
            setBankDetails(t("common.no_data_available"));
            return;
        }

        // Build bank details from customer object
        const details = [];

        if (customer.bank_comments) {
            details.push(customer.bank_comments);
        }

        if (customer.beneficiary_name) {
            details.push(
                `${t("fields.banking.beneficiary_name")}: ${customer.beneficiary_name}`
            );
        }

        if (customer.bank_name) {
            details.push(
                `${t("fields.banking.bank_name")}: ${customer.bank_name}`
            );
        }

        if (customer.branch_name) {
            details.push(
                `${t("fields.banking.branch_name")}: ${customer.branch_name}`
            );
        }

        if (customer.branch_number) {
            details.push(
                `${t("fields.banking.branch_number")}: ${customer.branch_number}`
            );
        }

        if (customer.account_number) {
            details.push(
                `${t("fields.banking.account_number")}: ${customer.account_number}`
            );
        }

        if (customer.iban) {
            details.push(`${t("fields.banking.iban")}: ${customer.iban}`);
        }

        if (customer.swift) {
            details.push(`${t("fields.banking.swift")}: ${customer.swift}`);
        }

        if (details.length === 0) {
            setBankDetails(t("fields.banking.no_bank_details_available"));
        } else {
            setBankDetails(details.join("\n"));
        }
    };

    useEffect(() => {
        if (isOpen) {
            getBankDetails();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, customer]);

    return (
        <DeleteDialog
            isOpen={isOpen}
            onClose={() => {
                setIsOpen(false);
            }}
            onConfirm={() => {
                onPaymentInitiated?.(); // ✅ tell parent payment was triggered
                setIsOpen(false);
            }}
            title={t("fields.banking.title")}
            description={
                <Box
                    sx={{
                        direction: i18n.language === "he" ? "rtl" : "ltr",
                        textAlign: i18n.language === "he" ? "right" : "left",
                    }}
                >
                    <Typography
                        variant="body2"
                        sx={{
                            fontWeight: 600,
                            mb: 2,
                            fontSize: "0.875rem",
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                            textAlign:
                                i18n.language === "he" ? "right" : "left",
                        }}
                    >
                        {t("fields.banking.bank_details")}
                    </Typography>
                    <Box
                        sx={{
                            backgroundColor: theme.palette.grey[100],
                            padding: theme.spacing(2),
                            borderRadius: theme.shape.borderRadius,
                            color: theme.palette.text.secondary,
                            whiteSpace: "pre-wrap",
                            fontSize: "0.875rem",
                            border: `1px solid ${theme.palette.divider}`,
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                            textAlign:
                                i18n.language === "he" ? "right" : "left",
                            fontFamily: theme.typography.fontFamily,
                            lineHeight: 1.5,
                        }}
                    >
                        {bankDetails || null}
                    </Box>
                </Box>
            }
            confirmLabel={t("fields.payment.pay_now")}
            cancelLabel={t("actions.cancel", { ns: "common" })}
            isLoading={false}
            type="info"
            maxWidth="sm"
            locale={i18n.language}
        />
    );
};

export default MakePaymentModal;
