"use client";

import { Code, Info as InfoIcon } from "@mui/icons-material";
import {
    Box,
    Button,
    Paper,
    Tooltip,
    Typography,
    useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import React from "react";
import { useTranslation } from "react-i18next";

import AppDialog from "@/shared/layout-components/modal/AppDialog";
import ModalScrollBox from "@/shared/layout-components/modal/ModalScrollBox";

interface EmailVariable {
    key: string;
    label: string;
    description: string;
    example: string;
}

const EMAIL_VARIABLES: EmailVariable[] = [
    { key: "{first_name}", label: "First Name", description: "Recipient's first name", example: "John" },
    { key: "{last_name}", label: "Last Name", description: "Recipient's last name", example: "Doe" },
    { key: "{customer_name}", label: "Customer Name", description: "Name of the customer", example: "ABC Company" },
    { key: "{account_name}", label: "Customer Name", description: "Your company name", example: "Your Company" },
    { key: "{link}", label: "Payment Link", description: "Payment settlement link", example: "https://pay.example.com/123" },
    { key: "{amount}", label: "Amount", description: "Outstanding amount", example: "$1,000.00" },
    { key: "{due_date}", label: "Due Date", description: "Payment due date", example: "2024-01-15" },
    { key: "{invoice_number}", label: "Invoice Number", description: "Invoice reference number", example: "INV-2024-001" },
    { key: "{account_email}", label: "Account Email", description: "Account email", example: "support@example.com" },
];

export interface VariableInsertionDialogProps {
    open: boolean;
    onClose: () => void;
    onInsertVariable: (variableKey: string) => void;
}

const VariableInsertionDialog: React.FC<VariableInsertionDialogProps> = ({
    open,
    onClose,
    onInsertVariable,
}) => {
    const { t, i18n } = useTranslation(["activities", "common"]);
    const theme = useTheme();
    const isHebrew = i18n.language === "he";

    const handleVariableClick = (variable: EmailVariable) => {
        onInsertVariable(variable.key);
        onClose();
    };

    return (
        <AppDialog
            open={open}
            onClose={onClose}
            drag
            align
            slide
            isRTL={isHebrew}
            scrollContainerId="variable-insertion-dialog-scroll"
            paperWidth="320px"
            paperMaxHeight="55vh"
            paperSx={{
                sx: {
                    "& > .MuiDialogTitle-root": {
                        flexShrink: 0,
                    },
                    "& > .MuiDialogContent-root": {
                        flex: "1 1 auto",
                        minHeight: 0,
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                        p: 0,
                    },
                    "& > .MuiDialogActions-root": {
                        flexShrink: 0,
                    },
                },
            }}
            title={t("tooltips.insert_variables", { ns: "activities" })}
            titleIcon={<Code aria-hidden="true" />}
            ariaLabelledBy="variable-insertion-dialog-title"
            ariaDescribedBy="variable-insertion-dialog-description"
            keepMounted
            actions={
                <Button
                    onClick={onClose}
                    variant="outlined"
                    size="small"
                    className="cancel-button"
                    sx={{
                        mr: isHebrew ? 0 : theme.spacing(1),
                        ml: isHebrew ? theme.spacing(1) : 0,
                    }}
                >
                    {t("actions.close", { ns: "common" })}
                </Button>
            }
        >
            <form
                style={{ display: "flex", flexDirection: "column", flex: "1 1 auto", minHeight: 0, overflow: "hidden" }}
                onSubmit={(e) => e.preventDefault()}
            >
                <ModalScrollBox id="variable-insertion-dialog-scroll" isRTL={isHebrew}>
                    <Box
                        id="variable-insertion-dialog-description"
                        component="div"
                        sx={{
                            direction: isHebrew ? "rtl" : "ltr",
                            textAlign: isHebrew ? "right" : "left",
                            p: 3,
                        }}
                    >
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mb: 2, direction: isHebrew ? "rtl" : "ltr", textAlign: isHebrew ? "right" : "left" }}
                        >
                            {t("tooltips.insert_variables_help", {
                                ns: "activities",
                                defaultValue: "Click on a variable to insert it into your content.",
                            })}
                        </Typography>
                        <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: "1fr", direction: isHebrew ? "rtl" : "ltr" }}>
                            {EMAIL_VARIABLES.map((variable) => (
                                <Paper
                                    key={variable.key}
                                    elevation={0}
                                    sx={{
                                        px: 2,
                                        py: 0.5,
                                        cursor: "pointer",
                                        "&:hover": { bgcolor: "action.hover" },
                                    }}
                                    onClick={() => handleVariableClick(variable)}
                                >
                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 0.5,
                                            flexWrap: "wrap",
                                            direction: isHebrew ? "rtl" : "ltr",
                                        }}
                                    >
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                fontFamily: "monospace",
                                                fontWeight: 600,
                                                lineHeight: 1.25,
                                                color: "primary.main",
                                                textAlign: isHebrew ? "right" : "left",
                                            }}
                                        >
                                            {variable.key}
                                        </Typography>
                                        <Tooltip
                                            title={variable.description}
                                            arrow
                                            enterDelay={300}
                                            leaveDelay={100}
                                            placement="bottom"
                                            PopperProps={{
                                                sx: {
                                                    "& .MuiTooltip-tooltip": { direction: isHebrew ? "rtl" : "ltr" },
                                                    "& .MuiTooltip-arrow": { ...(isHebrew && { transform: "scaleX(-1)" }) },
                                                },
                                            }}
                                        >
                                            <InfoIcon
                                                fontSize="small"
                                                sx={{
                                                    color: "text.secondary",
                                                    fontSize: "0.875rem",
                                                    cursor: "help",
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </Tooltip>
                                        <Typography
                                            variant="caption"
                                            sx={{
                                                lineHeight: 1.25,
                                                fontStyle: "italic",
                                                color: "text.secondary",
                                                direction: isHebrew ? "rtl" : "ltr",
                                                textAlign: isHebrew ? "right" : "left",
                                            }}
                                        >
                                            Example: {variable.example}
                                        </Typography>
                                    </Box>
                                </Paper>
                            ))}
                        </Box>
                    </Box>
                </ModalScrollBox>
            </form>
        </AppDialog>
    );
};

export default VariableInsertionDialog;
