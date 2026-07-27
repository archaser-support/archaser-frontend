"use client";

import {
    Box,
    Grid,
    TextField,
    Typography,
} from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";

import { CountrySelect, StateSelect } from "@/components/LocationSelects";

import { AccountDisplayData, CountryType, StateType } from "../types";



interface AddressInformationProps {
    customer: AccountDisplayData;
    onFieldChange: (key: string, value: any) => void;
    selectedCountry: CountryType | null;
    selectedState: StateType | null;
    validationErrors?: Record<string, string>;
}

const AddressInformation: React.FC<AddressInformationProps> = ({
    customer,
    onFieldChange,
    selectedCountry,
    selectedState,
    validationErrors = {},
}) => {
    const { t } = useTranslation(["accounts", "common"]);

    const handleCountryChange = (country: CountryType | null) => {
        const isUSOrCanada =
            country?.name === "United States" || country?.name === "Canada";
        const wasUSOrCanada =
            selectedCountry?.name === "United States" ||
            selectedCountry?.name === "Canada";

        onFieldChange("country_id", country?.id || null);

        if (wasUSOrCanada && !isUSOrCanada) {
            onFieldChange("state_id", null);
        }
    };

    const handleStateChange = (state: StateType | null) => {
        onFieldChange("state_id", state?.id || null);
    };

    const isStateSelectDisabled =
        !customer.country_id ||
        !["United States", "Canada"].includes(selectedCountry?.name || "");

    return (
        <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 3 }}>
                <Box sx={{ position: "relative" }}>
                    <TextField
                        fullWidth
                        size="small"
                        variant="outlined"
                        label={t("fields.address_line1", { ns: "accounts" })}
                        value={customer.address_line1 || ""}
                        onChange={(e) =>
                            onFieldChange("address_line1", e.target.value)
                        }
                        error={!!validationErrors.address_line1}
                        helperText={validationErrors.address_line1}
                        sx={{
                            padding: 0,
                            margin: 0,
                            "& .MuiFormControl-root": {
                                padding: 0,
                                margin: 0,
                            },
                            "& .MuiInputLabel-root": {
                                whiteSpace: "nowrap",
                                overflow: "visible",
                                textOverflow: "clip",
                            },
                            "& .MuiOutlinedInput-root": {
                                display: "flex !important",
                                alignItems: "center !important",
                            },
                            "& .MuiOutlinedInput-input": {
                                paddingTop: "6px !important",
                                paddingBottom: "6px !important",
                            },
                        }}
                    />
                </Box>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
                <Box sx={{ position: "relative" }}>
                    <TextField
                        fullWidth
                        size="small"
                        variant="outlined"
                        label={t("fields.address_line2", { ns: "accounts" })}
                        value={customer.address_line2 || ""}
                        onChange={(e) =>
                            onFieldChange("address_line2", e.target.value)
                        }
                        sx={{
                            padding: 0,
                            margin: 0,
                            "& .MuiFormControl-root": {
                                padding: 0,
                                margin: 0,
                            },
                            "& .MuiInputLabel-root": {
                                whiteSpace: "nowrap",
                                overflow: "visible",
                                textOverflow: "clip",
                            },
                            "& .MuiOutlinedInput-root": {
                                display: "flex !important",
                                alignItems: "center !important",
                            },
                            "& .MuiOutlinedInput-input": {
                                paddingTop: "6px !important",
                                paddingBottom: "6px !important",
                            },
                        }}
                    />
                </Box>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
                <Box sx={{ position: "relative" }}>
                    <TextField
                        fullWidth
                        size="small"
                        variant="outlined"
                        label={t("fields.city", { ns: "accounts" })}
                        value={customer.city || ""}
                        onChange={(e) => onFieldChange("city", e.target.value)}
                        error={!!validationErrors.city}
                        helperText={validationErrors.city}
                        sx={{
                            padding: 0,
                            margin: 0,
                            "& .MuiFormControl-root": {
                                padding: 0,
                                margin: 0,
                            },
                            "& .MuiInputLabel-root": {
                                whiteSpace: "nowrap",
                                overflow: "visible",
                                textOverflow: "clip",
                            },
                            "& .MuiOutlinedInput-root": {
                                display: "flex !important",
                                alignItems: "center !important",
                            },
                            "& .MuiOutlinedInput-input": {
                                paddingTop: "6px !important",
                                paddingBottom: "6px !important",
                            },
                        }}
                    />
                </Box>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
                <Box sx={{ position: "relative" }}>
                    <TextField
                        fullWidth
                        size="small"
                        variant="outlined"
                        label={t("fields.postal_code", { ns: "accounts" })}
                        value={customer.postal_code || ""}
                        onChange={(e) =>
                            onFieldChange("postal_code", e.target.value)
                        }
                        sx={{
                            padding: 0,
                            margin: 0,
                            "& .MuiFormControl-root": {
                                padding: 0,
                                margin: 0,
                            },
                            "& .MuiInputLabel-root": {
                                whiteSpace: "nowrap",
                                overflow: "visible",
                                textOverflow: "clip",
                            },
                            "& .MuiOutlinedInput-root": {
                                display: "flex !important",
                                alignItems: "center !important",
                            },
                            "& .MuiOutlinedInput-input": {
                                paddingTop: "6px !important",
                                paddingBottom: "6px !important",
                            },
                        }}
                    />
                </Box>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
                <Box
                    sx={{
                        position: "relative",
                        padding: 0,
                        margin: 0,
                        "& .MuiFormControl-root": {
                            padding: 0,
                            margin: 0,
                        },
                        "& .MuiInputLabel-root": {
                            whiteSpace: "nowrap",
                            overflow: "visible",
                            textOverflow: "clip",
                        },
                        "& .MuiOutlinedInput-root": {
                            display: "flex !important",
                            alignItems: "center !important",
                        },
                        "& .MuiOutlinedInput-input": {
                            paddingTop: "6px !important",
                            paddingBottom: "6px !important",
                        },
                    }}
                >
                    <div style={{ flex: 1 }}>
                        <CountrySelect
                            value={selectedCountry}
                            onChange={handleCountryChange}
                            label={`${t("fields.country", { ns: "common" })} *`}
                        />
                        {validationErrors.country_id && (
                            <Typography
                                variant="caption"
                                color="error"
                                sx={{ mt: 0.5, ml: 1.5 }}
                            >
                                {validationErrors.country_id}
                            </Typography>
                        )}
                    </div>
                </Box>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
                <Box
                    sx={{
                        position: "relative",
                        padding: 0,
                        margin: 0,
                        "& .MuiFormControl-root": {
                            padding: 0,
                            margin: 0,
                        },
                        "& .MuiInputLabel-root": {
                            whiteSpace: "nowrap",
                            overflow: "visible",
                            textOverflow: "clip",
                        },
                        "& .MuiOutlinedInput-root": {
                            display: "flex !important",
                            alignItems: "center !important",
                        },
                        "& .MuiOutlinedInput-input": {
                            paddingTop: "6px !important",
                            paddingBottom: "6px !important",
                        },
                    }}
                >
                    <div style={{ flex: 1 }}>
                        <StateSelect
                            value={selectedState}
                            onChange={handleStateChange}
                            label={t("fields.state", { ns: "accounts" })}
                            countryId={customer.country_id || undefined}
                            disabled={isStateSelectDisabled}
                        />
                    </div>
                </Box>
            </Grid>
        </Grid>
    );
};

export default AddressInformation;
