"use client";

import LocationOnIcon from "@mui/icons-material/LocationOn";
import { Box, Typography, Card, CardContent } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import React from "react";

import CustomerFormField from "./CustomerFormField";

interface CustomerAddressInfoProps {
    customer: any;
    isEditing: boolean;
    errors?: { [key: string]: string };
    onChange: (_field: string, _value: any) => void;
    countries: any[];
    states: any[];
    activeUsers: any[];
    t: (key: string, options?: { ns?: string }) => string;
    i18n: any;
}

const CustomerAddressInfo: React.FC<CustomerAddressInfoProps> = ({
    customer,
    isEditing,
    errors = {},
    onChange,
    countries,
    states,
    activeUsers,
    t,
    i18n,
}) => {
    const theme = useTheme();
    const isRTL = i18n.language === "he";
    const direction = isRTL ? "rtl" : "ltr";
    const textAlign = isRTL ? "right" : "left";

    const fieldConfig: Array<{
        field:
        | "country_id"
        | "state_id"
        | "address_line1"
        | "address_line2"
        | "city"
        | "postal_code";
        label: string;
        value: string;
        error?: string;
    }> = [
            {
                field: "country_id",
                label: t("fields.country", { ns: "common" }),
                value: customer?.country_id?.toString() || "",
                error: errors.country_id,
            },
            {
                field: "state_id",
                label: t("fields.state"),
                value: customer?.state_id?.toString() || "",
                error: errors.state,
            },
            {
                field: "address_line1",
                label: t("fields.address_1"),
                value: customer?.address_line1 || "",
                error: errors.address_line1,
            },
            {
                field: "address_line2",
                label: t("fields.address_2"),
                value: customer?.address_line2 || "",
                error: errors.address_line2,
            },
            {
                field: "city",
                label: t("fields.city"),
                value: customer?.city || "",
                error: errors.city,
            },
            {
                field: "postal_code",
                label: t("fields.postal_code"),
                value: customer?.postal_code || "",
                error: errors.postal_code,
            },
        ];

    return (
        <Card
            elevation={0}
            sx={{
                border: "none",
                borderRadius: { xs: 1, sm: 2 },
                mb: { xs: 2, sm: 4 },
                boxShadow: "none",
            }}
        >
            <Box
                sx={{
                    p: { xs: 1, sm: 1.25 },
                    mb: theme.spacing(1),
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                }}
            >
                <LocationOnIcon
                    sx={{
                        color: "primary.main",
                        fontSize: { xs: 18, sm: 20 },
                    }}
                />
                <Typography
                    variant="h6"
                    sx={{
                        fontWeight: 500,
                        fontSize: { xs: "1rem", sm: "1.25rem" },
                    }}
                >
                    {t("sections.address_information")}
                </Typography>
            </Box>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: {
                            xs: "1fr",
                            sm: "repeat(2, 1fr)",
                            md: "repeat(3, 1fr)",
                        },
                        gap: 3,
                        direction,
                        textAlign,
                    }}
                >
                    {fieldConfig.map((config) => (
                        <Box
                            key={config.field}
                            sx={{
                                position: "relative",
                                direction,
                                textAlign,
                            }}
                        >
                            <CustomerFormField
                                field={config.field}
                                value={config.value}
                                isEditing={isEditing}
                                error={config.error}
                                onChange={onChange}
                                countries={countries}
                                states={states}
                                activeUsers={activeUsers}
                                t={t}
                                editedCustomer={customer}
                                label={config.label}
                                icon={<LocationOnIcon />}
                            />
                        </Box>
                    ))}
                </Box>
            </CardContent>
        </Card>
    );
};

export default CustomerAddressInfo;
