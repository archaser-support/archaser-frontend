"use client";

import {
    ContentCopy as ContentCopyIcon,
    HelpOutline as HelpOutlineIcon,
} from "@mui/icons-material";
import {
    Box,
    Button,
    IconButton,
    Stack,
    Tooltip,
    Typography,
    useTheme,
} from "@mui/material";
import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import AppDialog from "@/shared/layout-components/modal/AppDialog";
import ModalScrollBox from "@/shared/layout-components/modal/ModalScrollBox";
import { getRTLTooltipProps } from "@/utils/reportFieldUtils";

const SCROLL_CONTAINER_ID = "formula-help-dialog-scroll";

const HELP_EXAMPLES = [
    "[Invoice.invoice_date] = [Invoice.due_date]",
    "[Invoice.invoice_date] = 2026-03-01",
    "[Invoice.amount] > 1000",
    "([Invoice.invoice_date] = [Invoice.due_date]) * [Invoice.amount]",
] as const;

export interface FormulaHelpDialogProps {
    open: boolean;
    onClose: () => void;
}

const FormulaHelpDialog: React.FC<FormulaHelpDialogProps> = ({
    open,
    onClose,
}) => {
    const { t, i18n } = useTranslation(["reports", "common"]);
    const theme = useTheme();
    const isRTL = i18n.language === "he";
    const [copiedExample, setCopiedExample] = useState<string | null>(null);

    const helpRules = [
        t("formulas.help_rule_operators", {
            defaultValue:
                "Compare with = != < > <= >= (use != for not equal).",
        }),
        t("formulas.help_rule_calendar_day", {
            defaultValue:
                "Date-only fields compare by calendar day (same day matches even if clock times differ).",
        }),
        t("formulas.help_rule_datetime", {
            defaultValue:
                "Date-and-time fields compare by full date and time.",
        }),
        t("formulas.help_rule_typed_date", {
            defaultValue:
                "Typed dates use year-month-day only, for example 2026-03-01 (no clock time).",
        }),
        t("formulas.help_rule_yes_no", {
            defaultValue:
                "Pick Yes/No format to show Yes or No. Underneath, Yes is 1 and No is 0 so other formulas can use the result.",
        }),
        t("formulas.help_rule_mixed_math", {
            defaultValue:
                "Mixing a compare with math needs parentheses, for example (date = date) * amount.",
        }),
        t("formulas.help_rule_grouping", {
            defaultValue:
                "On grouped reports, SUM/AVG/MIN/MAX of Yes/No shows as a number (a count), not Yes/No.",
        }),
        t("formulas.help_rule_types_only", {
            defaultValue:
                "Only dates and numbers can be compared. Text, Yes/No report fields, and lists are not allowed.",
        }),
    ];

    const handleCopy = useCallback(async (example: string) => {
        try {
            await navigator.clipboard.writeText(example);
            setCopiedExample(example);
            window.setTimeout(() => {
                setCopiedExample((current) =>
                    current === example ? null : current
                );
            }, 2000);
        } catch {
            // Clipboard may be unavailable; examples remain selectable.
        }
    }, []);

    return (
        <AppDialog
            open={open}
            onClose={onClose}
            drag
            align
            slide
            isRTL={isRTL}
            scrollContainerId={SCROLL_CONTAINER_ID}
            paperWidth="420px"
            paperMaxHeight="70vh"
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
            title={t("formulas.help_title", {
                defaultValue: "Formula help",
            })}
            titleIcon={<HelpOutlineIcon aria-hidden="true" />}
            ariaLabelledBy="formula-help-dialog-title"
            ariaDescribedBy="formula-help-dialog-description"
            actions={
                <Button
                    onClick={onClose}
                    variant="outlined"
                    size="small"
                    className="cancel-button"
                    fullWidth={false}
                    sx={{
                        mr: isRTL ? 0 : theme.spacing(1),
                        ml: isRTL ? theme.spacing(1) : 0,
                    }}
                >
                    {t("actions.close", { ns: "common" })}
                </Button>
            }
        >
            <Box
                id="formula-help-dialog-description"
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    flex: "1 1 auto",
                    minHeight: 0,
                    overflow: "hidden",
                    direction: isRTL ? "rtl" : "ltr",
                }}
            >
                <ModalScrollBox id={SCROLL_CONTAINER_ID} isRTL={isRTL}>
                    <Stack
                        spacing={2}
                        sx={{
                            p: 3,
                            direction: isRTL ? "rtl" : "ltr",
                            textAlign: isRTL ? "right" : "left",
                        }}
                    >
                        <Box>
                            <Typography
                                variant="subtitle2"
                                sx={{ mb: 1 }}
                            >
                                {t("formulas.help_rules_title", {
                                    defaultValue: "Rules",
                                })}
                            </Typography>
                            <Box
                                component="ul"
                                sx={{
                                    m: 0,
                                    pl: isRTL ? 0 : 2.5,
                                    pr: isRTL ? 2.5 : 0,
                                }}
                            >
                                {helpRules.map((rule) => (
                                    <Typography
                                        key={rule}
                                        component="li"
                                        variant="body2"
                                        color="text.secondary"
                                        sx={{ mb: 0.75 }}
                                    >
                                        {rule}
                                    </Typography>
                                ))}
                            </Box>
                        </Box>

                        <Box>
                            <Typography
                                variant="subtitle2"
                                sx={{ mb: 1 }}
                            >
                                {t("formulas.help_examples_title", {
                                    defaultValue: "Examples",
                                })}
                            </Typography>
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ mb: 1 }}
                            >
                                {t("formulas.help_examples_hint", {
                                    defaultValue:
                                        "Copy an example into your expression.",
                                })}
                            </Typography>
                            <Stack spacing={1}>
                                {HELP_EXAMPLES.map((example) => {
                                    const isCopied =
                                        copiedExample === example;
                                    return (
                                        <Box
                                            key={example}
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 1,
                                                border: `1px solid ${theme.palette.divider}`,
                                                borderRadius: `${theme.appButton.sizeMedium.borderRadius}px`,
                                                px: 1.5,
                                                py: 0.75,
                                                direction: "ltr",
                                            }}
                                        >
                                            <Typography
                                                variant="body2"
                                                component="code"
                                                sx={{
                                                    flex: 1,
                                                    minWidth: 0,
                                                    fontFamily: "monospace",
                                                    fontWeight: 600,
                                                    wordBreak: "break-all",
                                                    textAlign: "left",
                                                }}
                                            >
                                                {example}
                                            </Typography>
                                            <Tooltip
                                                title={
                                                    isCopied
                                                        ? t(
                                                              "formulas.help_copied",
                                                              {
                                                                  defaultValue:
                                                                      "Copied",
                                                              }
                                                          )
                                                        : t(
                                                              "formulas.help_copy",
                                                              {
                                                                  defaultValue:
                                                                      "Copy",
                                                              }
                                                          )
                                                }
                                                {...getRTLTooltipProps(i18n)}
                                            >
                                                <IconButton
                                                    size="small"
                                                    aria-label={t(
                                                        "formulas.help_copy",
                                                        {
                                                            defaultValue:
                                                                "Copy",
                                                        }
                                                    )}
                                                    onClick={() =>
                                                        handleCopy(example)
                                                    }
                                                >
                                                    <ContentCopyIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                    );
                                })}
                            </Stack>
                        </Box>
                    </Stack>
                </ModalScrollBox>
            </Box>
        </AppDialog>
    );
};

export default FormulaHelpDialog;
