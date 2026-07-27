import AppDialog from "@/shared/layout-components/modal/AppDialog";
import {
    Alert,
    Box,
    Button,
    Chip,
    FormControl,
    FormControlLabel,
    Grid,
    InputLabel,
    MenuItem,
    Select,
    Switch,
    Typography
} from "@mui/material";
import { AdapterMoment } from "@mui/x-date-pickers/AdapterMoment";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { TimePicker } from "@mui/x-date-pickers/TimePicker";
import moment from "moment-timezone";
import React, { useEffect, useState } from "react";

import { BusinessHours, ContactAvailability } from "../types/BusinessHours";
import { getContactAvailability } from "../utils/datetimeOperations";

interface ContactAvailabilityConfigProps {
    open: boolean;
    onClose: () => void;
    contactId: number;
    onSave: (availability: ContactAvailability) => void;
}

const DAYS_OF_WEEK = [
    { value: 0, label: "Sunday" },
    { value: 1, label: "Monday" },
    { value: 2, label: "Tuesday" },
    { value: 3, label: "Wednesday" },
    { value: 4, label: "Thursday" },
    { value: 5, label: "Friday" },
    { value: 6, label: "Saturday" },
];

const CHANNELS = [
    { value: "email", label: "Email" },
    { value: "sms", label: "SMS" },
    { value: "phone", label: "Phone" },
    { value: "whatsapp", label: "WhatsApp" },
];

const TIMEZONES = moment.tz.names();

export const ContactAvailabilityConfig: React.FC<
    ContactAvailabilityConfigProps
> = ({ open, onClose, contactId, onSave }) => {
    const [availability, setAvailability] = useState<ContactAvailability>({
        businessHours: {
            start: "09:00",
            end: "18:00",
            timezone: "UTC",
            daysOfWeek: [1, 2, 3, 4, 5],
        },
        preferredChannels: ["email", "sms"],
        urgencyLevels: {
            urgent: true,
            emergency: true,
        },
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open && contactId) {
            loadContactAvailability();
        }
    }, [open, contactId]);

    const loadContactAvailability = async () => {
        setLoading(true);
        try {
            const existingAvailability =
                await getContactAvailability(contactId);
            if (existingAvailability) {
                setAvailability(existingAvailability);
            }
        } catch (err) {
            setError("Failed to load contact availability");
            console.error("Error loading contact availability:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = () => {
        try {
            onSave(availability);
            onClose();
        } catch (err) {
            setError("Failed to save availability settings");
        }
    };

    const updateBusinessHours = (field: keyof BusinessHours, value: any) => {
        setAvailability((prev) => ({
            ...prev,
            businessHours: {
                ...prev.businessHours,
                [field]: value,
            },
        }));
    };

    const updatePreferredChannels = (channels: string[]) => {
        setAvailability((prev) => ({
            ...prev,
            preferredChannels: channels,
        }));
    };

    const updateUrgencyLevels = (
        field: keyof typeof availability.urgencyLevels,
        value: boolean
    ) => {
        setAvailability((prev) => ({
            ...prev,
            urgencyLevels: {
                ...prev.urgencyLevels,
                [field]: value,
            },
        }));
    };

    const toggleDayOfWeek = (day: number) => {
        const currentDays = availability.businessHours.daysOfWeek;
        const newDays = currentDays.includes(day)
            ? currentDays.filter((d) => d !== day)
            : [...currentDays, day].sort();

        updateBusinessHours("daysOfWeek", newDays);
    };

    return (
        <AppDialog
            open={open}
            onClose={onClose}
            drag={false}
            align={false}
            slide={false}
            isRTL={false}
            title="Contact Availability Configuration"
            titleIcon={null}
            ariaLabelledBy="contact-availability-config-title"
            ariaDescribedBy="contact-availability-config-description"
            maxWidth="md"
            fullWidth
            actions={
                <>
                    <Button
                        onClick={onClose}
                        variant="outlined"
                        size="small"
                        className="cancel-button"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        variant="contained"
                        size="small"
                        className="save-button"
                    >
                        Save Configuration
                    </Button>
                </>
            }
        >
            <Box id="contact-availability-config-description" component="div">
                {loading && (
                    <Box sx={{ textAlign: "center", py: 2 }}>
                        <Typography>
                            Loading availability settings...
                        </Typography>
                    </Box>
                )}

                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                {!loading && (
                    <Box sx={{ mt: 2 }}>
                        {/* Business Hours */}
                        <Typography variant="h6" sx={{ mb: 2 }}>
                            Business Hours
                        </Typography>

                        <Grid container spacing={2} sx={{ mb: 3 }}>
                            <Grid size={{ xs: 12, md: 6 }}>
                                <LocalizationProvider
                                    dateAdapter={AdapterMoment}
                                >
                                    <TimePicker
                                        label="Start Time"
                                        value={moment(
                                            availability.businessHours.start,
                                            "HH:mm"
                                        )}
                                        onChange={(newValue) => {
                                            const formattedValue =
                                                newValue && "format" in newValue
                                                    ? (newValue as any).format(
                                                        "HH:mm"
                                                    )
                                                    : "09:00";
                                            updateBusinessHours(
                                                "start",
                                                formattedValue
                                            );
                                        }}
                                        slotProps={{
                                            textField: { fullWidth: true },
                                        }}
                                    />
                                </LocalizationProvider>
                            </Grid>

                            <Grid size={{ xs: 12, md: 6 }}>
                                <LocalizationProvider
                                    dateAdapter={AdapterMoment}
                                >
                                    <TimePicker
                                        label="End Time"
                                        value={moment(
                                            availability.businessHours.end,
                                            "HH:mm"
                                        )}
                                        onChange={(newValue) => {
                                            const formattedValue =
                                                newValue && "format" in newValue
                                                    ? (newValue as any).format(
                                                        "HH:mm"
                                                    )
                                                    : "18:00";
                                            updateBusinessHours(
                                                "end",
                                                formattedValue
                                            );
                                        }}
                                        slotProps={{
                                            textField: { fullWidth: true },
                                        }}
                                    />
                                </LocalizationProvider>
                            </Grid>
                        </Grid>

                        {/* Timezone */}
                        <FormControl fullWidth sx={{ mb: 3 }}>
                            <InputLabel>Timezone</InputLabel>
                            <Select
                                value={availability.businessHours.timezone}
                                onChange={(e) =>
                                    updateBusinessHours(
                                        "timezone",
                                        e.target.value
                                    )
                                }
                                label="Timezone"
                            >
                                {TIMEZONES.map((tz) => (
                                    <MenuItem key={tz} value={tz}>
                                        {tz}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        {/* Working Days */}
                        <Typography variant="subtitle1" sx={{ mb: 1 }}>
                            Working Days
                        </Typography>
                        <Box sx={{ mb: 3 }}>
                            {DAYS_OF_WEEK.map((day) => (
                                <Chip
                                    key={day.value}
                                    label={day.label}
                                    onClick={() => toggleDayOfWeek(day.value)}
                                    color={
                                        availability.businessHours.daysOfWeek.includes(
                                            day.value
                                        )
                                            ? "primary"
                                            : "default"
                                    }
                                    sx={{ mr: 1, mb: 1 }}
                                />
                            ))}
                        </Box>

                        {/* Preferred Channels */}
                        <Typography variant="h6" sx={{ mb: 2 }}>
                            Preferred Communication Channels
                        </Typography>
                        <Box sx={{ mb: 3 }}>
                            {CHANNELS.map((channel) => (
                                <Chip
                                    key={channel.value}
                                    label={channel.label}
                                    onClick={() => {
                                        const current =
                                            availability.preferredChannels;
                                        const newChannels = current.includes(
                                            channel.value
                                        )
                                            ? current.filter(
                                                (c) => c !== channel.value
                                            )
                                            : [...current, channel.value];
                                        updatePreferredChannels(newChannels);
                                    }}
                                    color={
                                        availability.preferredChannels.includes(
                                            channel.value
                                        )
                                            ? "primary"
                                            : "default"
                                    }
                                    sx={{ mr: 1, mb: 1 }}
                                />
                            ))}
                        </Box>

                        {/* Urgency Levels */}
                        <Typography variant="h6" sx={{ mb: 2 }}>
                            Urgency Settings
                        </Typography>
                        <Box sx={{ mb: 3 }}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={
                                            availability.urgencyLevels.urgent
                                        }
                                        onChange={(e) =>
                                            updateUrgencyLevels(
                                                "urgent",
                                                e.target.checked
                                            )
                                        }
                                    />
                                }
                                label={
                                    <Typography variant="body2">
                                        {availability.urgencyLevels.urgent
                                            ? "Allow urgent messages outside business hours"
                                            : "Block urgent messages outside business hours"}
                                    </Typography>
                                }
                            />
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={
                                            availability.urgencyLevels.emergency
                                        }
                                        onChange={(e) =>
                                            updateUrgencyLevels(
                                                "emergency",
                                                e.target.checked
                                            )
                                        }
                                        disabled={!availability.urgencyLevels.urgent}
                                    />
                                }
                                label={
                                    <Typography variant="body2">
                                        {availability.urgencyLevels.emergency
                                            ? "Allow emergency messages anytime (requires urgent messages to be enabled)"
                                            : "Block emergency messages (requires urgent messages to be enabled)"}
                                    </Typography>
                                }
                            />
                        </Box>
                    </Box>
                )}
            </Box>
        </AppDialog>
    );
};
