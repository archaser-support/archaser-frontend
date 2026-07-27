"use client";

import {
    Box,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    TextField,
    Typography,
    Paper,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import React from "react";
import { useTranslation } from "react-i18next";

import { Field, getFieldOutputKey } from "@/utils/reportTableUtils";

interface ChartConfig {
    type: "bar" | "line" | "pie" | "area" | "table";
    xAxis?: string;
    yAxis?: string;
    title?: string;
}

interface ChartConfiguratorProps {
    selectedFields: Array<{
        table: string;
        field: string;
        alias?: string;
        aggregation?: string;
    }>;
    chart: ChartConfig | undefined;
    onChartChange: (chart: ChartConfig | undefined) => void;
}

const ChartConfigurator: React.FC<ChartConfiguratorProps> = ({
    selectedFields,
    chart,
    onChartChange,
}) => {
    const { t, i18n } = useTranslation(["reports", "common"]);
    const theme = useTheme();

    const numericFields = selectedFields.filter(
        (field) =>
            field.aggregation ||
            field.field.includes("amount") ||
            field.field.includes("count")
    );

    const handleChartTypeChange = (type: string) => {
        if (type === "none") {
            onChartChange(undefined);
        } else {
            onChartChange({
                type: type as ChartConfig["type"],
                xAxis: chart?.xAxis,
                yAxis: chart?.yAxis,
                title: chart?.title,
            });
        }
    };

    const handleFieldChange = (field: "xAxis" | "yAxis", value: string) => {
        if (!chart) return;
        onChartChange({
            ...chart,
            [field]: value,
        });
    };

    const handleTitleChange = (title: string) => {
        if (!chart) return;
        onChartChange({
            ...chart,
            title,
        });
    };

    const getFieldAxisValue = (field: {
        table: string;
        field: string;
        alias?: string;
        aggregation?: string;
    }) => getFieldOutputKey(field as Field);

    const getFieldAxisLabel = (field: {
        table: string;
        field: string;
        alias?: string;
        aggregation?: string;
    }) => {
        const base = field.alias || `${field.table}.${field.field}`;
        return field.aggregation ? `${base} ${field.aggregation}` : base;
    };

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Box>
                <Typography variant="h6">
                    {t("sections.chart_configuration", "Chart Configuration")}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {t(
                        "sections.chart_configuration_description",
                        "Configure how your report data will be visualized"
                    )}
                </Typography>
            </Box>

            <Paper
                elevation={0}
                sx={{
                    p: 2,
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 1,
                }}
            >
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <FormControl fullWidth>
                        <InputLabel>
                            {t("fields.chart_type", "Chart Type")}
                        </InputLabel>
                        <Select
                            value={chart?.type || "none"}
                            onChange={(e) =>
                                handleChartTypeChange(e.target.value)
                            }
                            label={t("fields.chart_type", "Chart Type")}
                        >
                            <MenuItem value="none">
                                {t("values.no_chart", "No Chart")}
                            </MenuItem>
                            <MenuItem value="bar">
                                {t("values.chart_type_bar", "Bar Chart")}
                            </MenuItem>
                            <MenuItem value="line">
                                {t("values.chart_type_line", "Line Chart")}
                            </MenuItem>
                            <MenuItem value="pie">
                                {t("values.chart_type_pie", "Pie Chart")}
                            </MenuItem>
                            <MenuItem value="area">
                                {t("values.chart_type_area", "Area Chart")}
                            </MenuItem>
                            <MenuItem value="table">
                                {t("values.chart_type_table", "Table")}
                            </MenuItem>
                        </Select>
                    </FormControl>

                    {chart && chart.type !== "table" && (
                        <>
                            <FormControl fullWidth>
                                <InputLabel>
                                    {t("fields.x_axis", "X-Axis")}
                                </InputLabel>
                                <Select
                                    value={chart.xAxis || ""}
                                    onChange={(e) =>
                                        handleFieldChange(
                                            "xAxis",
                                            e.target.value
                                        )
                                    }
                                    label={t("fields.x_axis", "X-Axis")}
                                >
                                    {selectedFields.map((field, index) => (
                                        <MenuItem
                                            key={index}
                                            value={getFieldAxisValue(field)}
                                        >
                                            {getFieldAxisLabel(field)}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            {chart.type !== "pie" && (
                                <FormControl fullWidth>
                                    <InputLabel>
                                        {t("fields.y_axis", "Y-Axis")}
                                    </InputLabel>
                                    <Select
                                        value={chart.yAxis || ""}
                                        onChange={(e) =>
                                            handleFieldChange(
                                                "yAxis",
                                                e.target.value
                                            )
                                        }
                                        label={t("fields.y_axis", "Y-Axis")}
                                    >
                                        {numericFields.map((field, index) => (
                                            <MenuItem
                                                key={index}
                                                value={getFieldAxisValue(
                                                    field
                                                )}
                                            >
                                                {getFieldAxisLabel(field)}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            )}

                            <TextField
                                label={t("fields.chart_title", "Chart Title")}
                                value={chart.title || ""}
                                onChange={(e) =>
                                    handleTitleChange(e.target.value)
                                }
                                fullWidth
                                placeholder={t(
                                    "fields.chart_title_placeholder",
                                    "Enter chart title"
                                )}
                            />
                        </>
                    )}
                </Box>
            </Paper>
        </Box>
    );
};

export default ChartConfigurator;
