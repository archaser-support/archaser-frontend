import { Autocomplete, TextField, Box, Typography } from "@mui/material";
import { useTheme , ThemeProvider } from "@mui/material/styles";
import { useQuery } from "@tanstack/react-query";
import React from "react";

import api from "@/app/api";

// ✅ Centralized curated list of common locales
export const availableLocales: string[] = [
    "en-US",
    "en-GB",
    "he-IL",
    "fr-FR",
    "de-DE",
    "es-ES",
    "pt-PT",
    "pt-BR",
    "ru-RU",
    "zh-CN",
    "zh-TW",
    "ja-JP",
    "ko-KR",
    "ar-SA",
    "hi-IN",
    "it-IT",
    "nl-NL",
    "sv-SE",
    "no-NO",
    "da-DK",
    "fi-FI",
    "pl-PL",
    "tr-TR",
    "th-TH",
    "cs-CZ",
    "hu-HU",
    "ro-RO",
    "vi-VN",
    "uk-UA",
    "id-ID",
];

interface StateType {
    id: number;
    name: string;
    country_id: number;
}

interface CountryType {
    id: number;
    name: string;
    emoji: string | null;
    iso2: string | null;
    iso3: string | null;
    numeric_code: string | null;
    phonecode: string | null;
    capital: string | null;
    currency: string | null;
    currency_name: string | null;
    currency_symbol: string | null;
    tld: string | null;
    native: string | null;
    region: string | null;
    subregion: string | null;
    timezones: string | null;
    translations: string | null;
    latitude: string | null;
    longitude: string | null;
    emojiU: string | null;
    wikiDataId: string | null;
}

interface CountryProps {
    value: CountryType | null;
    onChange: (value: CountryType | null) => void;
    label?: string;
    disabled?: boolean;
}

interface StateProps {
    value: StateType | null;
    onChange: (value: StateType | null) => void;
    countryId?: number;
    label?: string;
}

interface LocaleProps {
    value: string;
    onChange: (value: string) => void;
    label?: string;
}

const StateSelect: React.FC<StateProps> = ({
    countryId,
    value,
    onChange,
    label,
}) => {
    const {
        data: states = [],
        isLoading,
        error,
    } = useQuery<StateType[]>({
        queryKey: ["states", countryId?.toString()],
        queryFn: async () => {
            if (!countryId) return [];
            try {
                const response = await api.get<StateType[]>("/state", {
                    params: { country_id: countryId },
                });
                return response.data;
            } catch (error) {
                return [];
            }
        },
        enabled: !!countryId,
    });

    return (
        <Autocomplete<StateType>
            value={value}
            onChange={(_, newValue) => onChange?.(newValue)}
            options={states}
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(option, value) => option.id === value?.id}
            disabled={!countryId}
            loading={isLoading}
            renderOption={(props, option) => (
                <li {...props}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Typography>{option.name}</Typography>
                    </Box>
                </li>
            )}
            renderInput={(params) => (
                <TextField
                    {...params}
                    label={label || "State"}
                    error={!!error}
                    helperText={error ? "Failed to load states" : ""}
                    fullWidth
                />
            )}
        />
    );
};

export const LocaleSelect: React.FC<LocaleProps> = ({
    value,
    onChange,
    label,
}) => {
    const outerTheme = useTheme();

    const getLocaleEmoji = (locale: string) => {
        const regionCode = locale.split("-")[1];
        const codePoints = regionCode
            .toUpperCase()
            .split("")
            .map((char) => 127397 + char.charCodeAt(0));
        return String.fromCodePoint(...codePoints);
    };

    return (
        <ThemeProvider theme={outerTheme}>
            <Autocomplete
                value={value}
                onChange={(_, newValue) => onChange?.(newValue || "")}
                options={availableLocales}
                getOptionLabel={(option) => {
                    const [langCode, regionCode] = option.split("-");
                    const language =
                        new Intl.DisplayNames([option], {
                            type: "language",
                        }).of(langCode) || langCode;
                    const region =
                        new Intl.DisplayNames([option], { type: "region" }).of(
                            regionCode
                        ) || regionCode;
                    return `${getLocaleEmoji(option)} ${language} (${region})`;
                }}
                renderOption={(props, option) => {
                    const [langCode, regionCode] = option.split("-");
                    const language =
                        new Intl.DisplayNames([option], {
                            type: "language",
                        }).of(langCode) || langCode;
                    const region =
                        new Intl.DisplayNames([option], { type: "region" }).of(
                            regionCode
                        ) || regionCode;
                    return (
                        <li {...props}>
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                }}
                            >
                                <Typography>
                                    {getLocaleEmoji(option)}
                                </Typography>
                                <Typography>
                                    {language} ({region})
                                </Typography>
                            </Box>
                        </li>
                    );
                }}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        label={label || "Locale"}
                        variant="outlined"
                        fullWidth
                    />
                )}
            />
        </ThemeProvider>
    );
};

export default function Country({
    value,
    onChange,
    label,
    disabled,
}: CountryProps) {
    const outerTheme = useTheme();
    const { data: countries = [] } = useQuery<CountryType[]>({
        queryKey: ["countries"],
        queryFn: async () => {
            const response = await api.get<CountryType[]>("/country");
            return response.data;
        },
    });

    return (
        <ThemeProvider theme={outerTheme}>
            <Autocomplete<CountryType>
                value={value}
                onChange={(_, newValue) => onChange?.(newValue)}
                options={countries}
                getOptionLabel={(option) =>
                    `${option.emoji || "🏳️"} ${option.name}`
                }
                disabled={disabled}
                renderOption={(props, option) => (
                    <li {...props}>
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                            }}
                        >
                            <Typography>{option.emoji || "🏳️"}</Typography>
                            <Typography>{option.name}</Typography>
                        </Box>
                    </li>
                )}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        label={label || "Country"}
                        variant="outlined"
                        fullWidth
                    />
                )}
                isOptionEqualToValue={(option, value) =>
                    option.id === value?.id
                }
            />
        </ThemeProvider>
    );
}

export { StateSelect };
