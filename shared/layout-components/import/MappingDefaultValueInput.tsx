"use client";

import { Autocomplete, Box, TextField } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import React, { useMemo } from "react";

import api from "@/app/api";
import {
    MAPPING_DEFAULT_BOOLEAN_OPTIONS,
    getMappingDefaultPicklistKind,
    type ConnectorFieldTransform,
} from "@/shared/constants/importEntityFields";

interface CountryOption {
    id: number;
    name: string;
    iso2: string | null;
    emoji: string | null;
}

interface StateOption {
    id: number;
    name: string;
    iso2: string | null;
    country_id: number;
}

interface BusinessUnitOption {
    id: number;
    name: string;
    external_id?: string | null;
}

const GRID_AUTOCOMPLETE_SX = {
    width: "100%",
    // Theme MuiFormControl adds marginBottom: 16px — breaks grid cell centering
    "& .MuiFormControl-root": { m: 0 },
} as const;

interface MappingDefaultValueInputProps {
    accountId: number;
    archaserField: string;
    transform?: ConnectorFieldTransform;
    value: string;
    disabled?: boolean;
    /** Country ISO2 default from the country_iso2 mapping row (for state options). */
    countryIso2Default?: string;
    onChange: (value: string) => void;
}

export default function MappingDefaultValueInput({
    accountId,
    archaserField,
    transform,
    value,
    disabled = false,
    countryIso2Default,
    onChange,
}: MappingDefaultValueInputProps) {
    const picklistKind = getMappingDefaultPicklistKind(archaserField, transform);

    const { data: countries = [] } = useQuery<CountryOption[]>({
        queryKey: ["countries"],
        queryFn: async () => {
            const response = await api.get<CountryOption[]>("/api/country");
            return response.data;
        },
        enabled: picklistKind === "country_iso2" || picklistKind === "state_iso2",
        staleTime: 5 * 60 * 1000,
    });

    const selectedCountry = useMemo(
        () =>
            countries.find(
                (country) =>
                    country.iso2 &&
                    country.iso2.toUpperCase() ===
                        (countryIso2Default ?? "").trim().toUpperCase()
            ) ?? null,
        [countries, countryIso2Default]
    );

    const { data: states = [] } = useQuery<StateOption[]>({
        queryKey: ["states", selectedCountry?.id?.toString() ?? ""],
        queryFn: async () => {
            if (!selectedCountry?.id) {
                return [];
            }
            const response = await api.get<StateOption[]>("/api/state", {
                params: { country_id: selectedCountry.id },
            });
            return response.data;
        },
        enabled: picklistKind === "state_iso2" && Boolean(selectedCountry?.id),
        staleTime: 5 * 60 * 1000,
    });

    const { data: businessUnits = [] } = useQuery<BusinessUnitOption[]>({
        queryKey: ["business-units-all", accountId],
        queryFn: async () => {
            const response = await api.get(
                `/api/entities/accounts/${accountId}/business-units`,
                { params: { page: 1, limit: 1000 } }
            );
            const payload = response.data;
            return Array.isArray(payload)
                ? payload
                : Array.isArray(payload?.data)
                  ? payload.data
                  : [];
        },
        enabled: picklistKind === "business_unit",
        staleTime: 60 * 1000,
    });

    const countryOptions = useMemo(
        () =>
            countries
                .filter((country) => country.iso2)
                .map((country) => country.iso2 as string),
        [countries]
    );

    const stateOptions = useMemo(
        () =>
            states
                .filter((state) => state.iso2)
                .map((state) => state.iso2 as string),
        [states]
    );

    const businessUnitOptions = useMemo(
        () =>
            businessUnits
                .map((unit) => unit.external_id?.trim() ?? "")
                .filter(Boolean),
        [businessUnits]
    );

    if (picklistKind === "boolean") {
        return (
            <Autocomplete
                size="small"
                options={[...MAPPING_DEFAULT_BOOLEAN_OPTIONS]}
                value={value || null}
                disabled={disabled}
                onChange={(_, next) => onChange(next ?? "")}
                sx={GRID_AUTOCOMPLETE_SX}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        size="small"
                        placeholder="If empty…"
                        sx={{ m: 0 }}
                    />
                )}
            />
        );
    }

    if (picklistKind === "country_iso2") {
        return (
            <Autocomplete
                size="small"
                options={countryOptions}
                value={value || null}
                disabled={disabled}
                onChange={(_, next) => onChange(next ?? "")}
                sx={GRID_AUTOCOMPLETE_SX}
                getOptionLabel={(option) => {
                    const country = countries.find((item) => item.iso2 === option);
                    if (!country) {
                        return option;
                    }
                    return `${country.emoji || ""} ${country.name} (${option})`.trim();
                }}
                renderOption={(props, option) => {
                    const country = countries.find((item) => item.iso2 === option);
                    return (
                        <li {...props} key={option}>
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                }}
                            >
                                <span>{country?.emoji || "🏳️"}</span>
                                <span>
                                    {country?.name ?? option} ({option})
                                </span>
                            </Box>
                        </li>
                    );
                }}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        size="small"
                        placeholder="Country ISO2…"
                        sx={{ m: 0 }}
                    />
                )}
            />
        );
    }

    if (picklistKind === "state_iso2") {
        return (
            <Autocomplete
                size="small"
                options={stateOptions}
                value={value || null}
                disabled={disabled || !selectedCountry}
                onChange={(_, next) => onChange(next ?? "")}
                sx={GRID_AUTOCOMPLETE_SX}
                getOptionLabel={(option) => {
                    const state = states.find((item) => item.iso2 === option);
                    if (!state) {
                        return option;
                    }
                    return `${state.name} (${option})`;
                }}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        size="small"
                        placeholder={
                            selectedCountry
                                ? "State ISO2…"
                                : "Set country default first"
                        }
                        sx={{ m: 0 }}
                    />
                )}
            />
        );
    }

    if (picklistKind === "business_unit") {
        return (
            <Autocomplete
                size="small"
                options={businessUnitOptions}
                value={value || null}
                disabled={disabled}
                onChange={(_, next) => onChange(next ?? "")}
                sx={GRID_AUTOCOMPLETE_SX}
                getOptionLabel={(option) => {
                    const unit = businessUnits.find(
                        (item) => item.external_id === option
                    );
                    if (!unit) {
                        return option;
                    }
                    return `${unit.name} (${option})`;
                }}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        size="small"
                        placeholder="Business unit…"
                        sx={{ m: 0 }}
                    />
                )}
            />
        );
    }

    return (
        <TextField
            size="small"
            fullWidth
            disabled={disabled}
            placeholder="If empty…"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            sx={{ m: 0 }}
        />
    );
}
