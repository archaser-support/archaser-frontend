"use client";

import {
    Person,
    Business,
    CheckCircle,
    ExpandMore,
    Search as SearchIcon,
    Clear as ClearIcon,
} from "@mui/icons-material";
import {
    Box,
    Typography,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Checkbox,
    TextField,
    Chip,
    IconButton,
    InputAdornment,
    Skeleton,
    useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useQuery } from "@tanstack/react-query";
import React, { useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useDebounce } from "use-debounce";

import api from "@/app/api";
import { useRTL } from "./hooks/useRTL";
import { filterValidContacts } from "./MassSendEmailModal.utils";
import { CustomerRow, ContactWithCustomer } from "./MassSendEmailModal.types";
import { Contact } from "@/types/contact";
import { EMAIL_CONFIG } from "./MassSendEmailModal.constants";

interface CustomerAccordionProps {
    customer: CustomerRow;
    customerName: string;
    isExpanded: boolean;
    onToggle: () => void;
    selectedContactIds: number[];
    onContactToggle: (contactId: number) => void;
    onSelectAll: (contactIds: number[]) => void;
    onDeselectAll: () => void;
    searchTerm: string;
    onSearchChange: (term: string) => void;
    isSending: boolean;
    isOpen: boolean;
    selectRegularContacts?: boolean;
    selectEscalatedContacts?: boolean;
}

const CustomerAccordion: React.FC<CustomerAccordionProps> = ({
    customer,
    customerName,
    isExpanded,
    onToggle,
    selectedContactIds,
    onContactToggle,
    onSelectAll,
    onDeselectAll,
    searchTerm,
    onSearchChange,
    isSending,
    isOpen,
    selectRegularContacts = false,
    selectEscalatedContacts = false,
}) => {
    const { t } = useTranslation([
        "customers",
        "activities",
        "common",
        "contacts",
    ]);
    const theme = useTheme();
    const { isRTL, direction, textAlign, flexDirection } = useRTL();

    // Debounced search term
    const [debouncedSearchTerm] = useDebounce(
        searchTerm,
        EMAIL_CONFIG.DEBOUNCE_DELAY
    );

    // Fetch contacts for this customer (lazy loading)
    const companyId = customer.company_id || 0;
    const customerIdNumber = parseInt(customer.id.toString(), 10);

    const { data: contactsData, isLoading: isLoadingContacts } = useQuery({
        queryKey: [
            "contacts-for-mass-email",
            customerIdNumber,
            companyId,
            customer.type,
        ],
        queryFn: async () => {
            const params: any = {
                page: 1,
                limit: 1000,
                sortField: "first_name",
                sortDirection: "asc",
                status: "1",
            };

            // Always filter by customerId to get contacts ONLY for this specific customer
            // This works for both Person and Company customers
            params.customerId = customerIdNumber;

            const response = await api.get("/entities/contacts", { params });

            if (response.data?.contacts) {
                const filtered = filterValidContacts(
                    response.data.contacts.filter(
                        (contact: Contact) =>
                            contact.customer_id === customerIdNumber
                    )
                );
                return {
                    ...response.data,
                    contacts: filtered,
                    totalRecords: filtered.length,
                };
            }

            return response.data || { contacts: [], totalRecords: 0 };
        },
        enabled: isOpen && isExpanded && !!customerIdNumber,
        staleTime: EMAIL_CONFIG.CONTACTS_CACHE_TIME,
    });

    const validContacts = useMemo(() => {
        if (!contactsData?.contacts) return [];
        return filterValidContacts(
            contactsData.contacts.filter(
                (contact: Contact) => contact.customer_id === customer.id
            )
        );
    }, [contactsData, customer.id]);

    // Handle regular/escalated contacts switches
    useEffect(() => {
        if (!isExpanded || validContacts.length === 0) return;

        const regularContactIds = validContacts
            .filter((c: Contact) => !c.receives_escalated_reminder)
            .map((c: Contact) => c.id);

        const escalatedContactIds = validContacts
            .filter((c: Contact) => c.receives_escalated_reminder === true)
            .map((c: Contact) => c.id);

        const currentSelected = new Set(selectedContactIds);
        const newSelected = new Set(selectedContactIds);

        // Handle regular contacts switch
        if (selectRegularContacts) {
            regularContactIds.forEach((id: number) => newSelected.add(id));
        } else {
            regularContactIds.forEach((id: number) => newSelected.delete(id));
        }

        // Handle escalated contacts switch
        if (selectEscalatedContacts) {
            escalatedContactIds.forEach((id: number) => newSelected.add(id));
        } else {
            escalatedContactIds.forEach((id: number) => newSelected.delete(id));
        }

        // Only update if selection changed
        const newSelectedArray = Array.from(newSelected);
        if (
            newSelectedArray.length !== currentSelected.size ||
            !newSelectedArray.every((id) => currentSelected.has(id))
        ) {
            onSelectAll(newSelectedArray);
        }
    }, [
        selectRegularContacts,
        selectEscalatedContacts,
        validContacts,
        isExpanded,
        selectedContactIds,
        onSelectAll,
    ]);

    // Filter contacts based on debounced search term
    const filteredContacts = useMemo(() => {
        if (!debouncedSearchTerm.trim()) return validContacts;
        const searchLower = debouncedSearchTerm.toLowerCase();
        return validContacts.filter(
            (contact: Contact) =>
                `${contact.first_name} ${contact.last_name || ""}`
                    .trim()
                    .toLowerCase()
                    .includes(searchLower) ||
                (contact.email &&
                    contact.email.toLowerCase().includes(searchLower))
        );
    }, [validContacts, debouncedSearchTerm]);

    const allSelected =
        filteredContacts.length > 0 &&
        filteredContacts.every((contact: Contact) =>
            selectedContactIds.includes(contact.id)
        );
    const someSelected = filteredContacts.some((contact: Contact) =>
        selectedContactIds.includes(contact.id)
    );

    const handleSelectAllToggle = () => {
        if (allSelected) {
            onDeselectAll();
        } else {
            onSelectAll(filteredContacts.map((c: Contact) => c.id));
        }
    };

    return (
        <Accordion
            expanded={isExpanded}
            onChange={onToggle}
            disabled={isSending}
            sx={{ mb: 1 }}
        >
            <AccordionSummary
                expandIcon={<ExpandMore />}
                sx={{
                    direction,
                }}
            >
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        width: "100%",
                        flexDirection,
                    }}
                >
                    {customer.type === "Person" ? (
                        <Person
                            sx={{ fontSize: 20, color: "text.secondary" }}
                        />
                    ) : (
                        <Business
                            sx={{ fontSize: 20, color: "text.secondary" }}
                        />
                    )}
                    <Typography
                        variant="body2"
                        sx={{
                            fontWeight: 500,
                            flex: 1,
                            textAlign,
                        }}
                    >
                        {customerName}
                    </Typography>
                    {selectedContactIds.length > 0 && (
                        <Chip
                            icon={<CheckCircle />}
                            label={`${selectedContactIds.length} ${t("actions.selected", { ns: "common" })}`}
                            color="primary"
                            sx={{
                                fontWeight: 600,
                                height: 32,
                                cursor: "pointer",
                                "&:hover": {
                                    backgroundColor: theme.palette.primary.dark,
                                },
                            }}
                        />
                    )}
                </Box>
            </AccordionSummary>
            <AccordionDetails
                sx={{
                    direction,
                }}
            >
                {isLoadingContacts ? (
                    <Box>
                        <Skeleton height={40} />
                        <Skeleton height={40} />
                        <Skeleton height={40} />
                    </Box>
                ) : validContacts.length === 0 ? (
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                            textAlign,
                        }}
                    >
                        {t("messages.no_valid_contacts_for_customer", {
                            customerName,
                            ns: "activities",
                        })}
                    </Typography>
                ) : (
                    <>
                        {/* Search Bar */}
                        <TextField
                            fullWidth
                            size="small"
                            placeholder={t("fields.search_placeholder", {
                                ns: "common",
                            })}
                            value={searchTerm}
                            onChange={(e) => onSearchChange(e.target.value)}
                            dir={direction}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment
                                        position="start"
                                        sx={{
                                            ...(isRTL && {
                                                marginRight: 0,
                                                marginLeft: theme.spacing(1),
                                            }),
                                        }}
                                    >
                                        <SearchIcon fontSize="small" />
                                    </InputAdornment>
                                ),
                                endAdornment: searchTerm && (
                                    <InputAdornment
                                        position="end"
                                        sx={{
                                            ...(isRTL && {
                                                marginLeft: 0,
                                                marginRight: theme.spacing(1),
                                            }),
                                        }}
                                    >
                                        <IconButton
                                            size="small"
                                            onClick={() => onSearchChange("")}
                                        >
                                            <ClearIcon fontSize="small" />
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                            sx={{
                                mb: 2,
                                "& .MuiInputBase-input": {
                                    textAlign,
                                    direction,
                                },
                            }}
                        />

                        {/* Select All / Deselect All */}
                        <Box
                            sx={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                mb: 1,
                                flexDirection,
                                direction,
                            }}
                        >
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    flexDirection,
                                }}
                            >
                                <Checkbox
                                    checked={allSelected}
                                    indeterminate={someSelected && !allSelected}
                                    onChange={handleSelectAllToggle}
                                    size="small"
                                />
                                <Typography
                                    variant="body2"
                                    sx={{
                                        textAlign,
                                        direction,
                                    }}
                                >
                                    {allSelected
                                        ? t("actions.deselect_all", {
                                              ns: "common",
                                          })
                                        : t("actions.select_all", {
                                              ns: "common",
                                          })}
                                </Typography>
                            </Box>
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{
                                    textAlign,
                                    direction,
                                }}
                            >
                                {filteredContacts.length}{" "}
                                {t("fields.contacts", { ns: "contacts" })}
                            </Typography>
                        </Box>

                        {/* Contact List */}
                        <Box
                            sx={{
                                maxHeight: "250px",
                                overflowY: "auto",
                                overflowX: "hidden",
                                pr: 1,
                                "&::-webkit-scrollbar": {
                                    width: "8px",
                                },
                                "&::-webkit-scrollbar-track": {
                                    backgroundColor:
                                        theme.palette.mode === "dark"
                                            ? "rgba(255, 255, 255, 0.1)"
                                            : "rgba(0, 0, 0, 0.05)",
                                    borderRadius: "4px",
                                },
                                "&::-webkit-scrollbar-thumb": {
                                    backgroundColor:
                                        theme.palette.mode === "dark"
                                            ? "rgba(255, 255, 255, 0.3)"
                                            : "rgba(0, 0, 0, 0.3)",
                                    borderRadius: "4px",
                                    "&:hover": {
                                        backgroundColor:
                                            theme.palette.mode === "dark"
                                                ? "rgba(255, 255, 255, 0.5)"
                                                : "rgba(0, 0, 0, 0.4)",
                                    },
                                },
                                // Firefox scrollbar styling
                                scrollbarWidth: "thin",
                                scrollbarColor:
                                    theme.palette.mode === "dark"
                                        ? "rgba(255, 255, 255, 0.3) rgba(255, 255, 255, 0.1)"
                                        : "rgba(0, 0, 0, 0.3) rgba(0, 0, 0, 0.05)",
                            }}
                        >
                            {filteredContacts.map((contact: Contact) => {
                                const isSelected = selectedContactIds.includes(
                                    contact.id
                                );
                                return (
                                    <Box
                                        key={contact.id}
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            py: 0.25,
                                            px: 0.5,
                                            mb: 0.125,
                                            borderRadius: 0.5,
                                            bgcolor: isSelected
                                                ? alpha(
                                                      theme.palette.primary
                                                          .main,
                                                      0.08
                                                  )
                                                : "transparent",
                                            ...(isRTL
                                                ? {
                                                      borderRight: isSelected
                                                          ? `2px solid ${theme.palette.primary.main}`
                                                          : "2px solid transparent",
                                                  }
                                                : {
                                                      borderLeft: isSelected
                                                          ? `2px solid ${theme.palette.primary.main}`
                                                          : "2px solid transparent",
                                                  }),
                                            "&:hover": {
                                                bgcolor: isSelected
                                                    ? alpha(
                                                          theme.palette.primary
                                                              .main,
                                                          0.15
                                                      )
                                                    : alpha(
                                                          theme.palette.primary
                                                              .main,
                                                          0.05
                                                      ),
                                                transform: isRTL
                                                    ? "translateX(-2px)"
                                                    : "translateX(2px)",
                                                transition: "all 0.2s ease",
                                            },
                                            flexDirection,
                                            direction,
                                        }}
                                    >
                                        <Checkbox
                                            checked={isSelected}
                                            onChange={() =>
                                                onContactToggle(contact.id)
                                            }
                                            size="small"
                                        />
                                        <Box
                                            sx={{
                                                flex: 1,
                                                ml: isRTL ? 0 : 0.5,
                                                mr: isRTL ? 0.5 : 0,
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 0.75,
                                                flexDirection,
                                            }}
                                        >
                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    textAlign,
                                                    direction,
                                                }}
                                            >
                                                {`${contact.first_name} ${contact.last_name || ""}`.trim() ||
                                                    contact.email}
                                            </Typography>
                                            {contact.email &&
                                                `${contact.first_name} ${contact.last_name || ""}`.trim() && (
                                                    <Typography
                                                        variant="caption"
                                                        color="text.secondary"
                                                        sx={{
                                                            textAlign,
                                                            direction,
                                                        }}
                                                    >
                                                        ({contact.email})
                                                    </Typography>
                                                )}
                                        </Box>
                                    </Box>
                                );
                            })}
                        </Box>
                    </>
                )}
            </AccordionDetails>
        </Accordion>
    );
};

export default CustomerAccordion;
