import { useState, useCallback, useMemo } from "react";
import {
    ContactWithCustomer,
    SelectionSummary,
} from "../MassSendEmailModal.types";

export const useContactSelection = () => {
    const [selectedContactsByCustomer, setSelectedContactsByCustomer] =
        useState<Record<number, number[]>>({});
    const [selectRegularContacts, setSelectRegularContacts] = useState(false);
    const [selectEscalatedContacts, setSelectEscalatedContacts] =
        useState(false);

    const selectionSummary = useMemo<SelectionSummary>(() => {
        const customerIds = Object.keys(selectedContactsByCustomer).map(Number);
        const totalContacts = Object.values(selectedContactsByCustomer).reduce(
            (sum, ids) => sum + ids.length,
            0
        );
        return {
            customerCount: customerIds.length,
            totalContacts,
        };
    }, [selectedContactsByCustomer]);

    const handleContactToggle = useCallback(
        (customerId: number, contactId: number) => {
            setSelectedContactsByCustomer((prev) => {
                const current = prev[customerId] || [];
                const newSelection = current.includes(contactId)
                    ? current.filter((id) => id !== contactId)
                    : [...current, contactId];
                return {
                    ...prev,
                    [customerId]: newSelection,
                };
            });
        },
        []
    );

    const handleSelectAllForCustomer = useCallback(
        (customerId: number, contactIds: number[]) => {
            setSelectedContactsByCustomer((prev) => ({
                ...prev,
                [customerId]: contactIds,
            }));
        },
        []
    );

    const handleDeselectAllForCustomer = useCallback((customerId: number) => {
        setSelectedContactsByCustomer((prev) => {
            const newState = { ...prev };
            delete newState[customerId];
            return newState;
        });
    }, []);

    const handleContactTypeToggle = useCallback(
        (
            contactType: "regular" | "escalated",
            checked: boolean,
            allContactsData: ContactWithCustomer[] | undefined
        ) => {
            if (contactType === "regular") {
                setSelectRegularContacts(checked);
            } else {
                setSelectEscalatedContacts(checked);
            }

            if (!allContactsData) return;

            setSelectedContactsByCustomer((prev) => {
                const newState = { ...prev };

                allContactsData.forEach((contact) => {
                    const customerId = contact.customerId;
                    const isTargetType =
                        contactType === "regular"
                            ? !contact.receives_escalated_reminder
                            : contact.receives_escalated_reminder === true;

                    if (isTargetType) {
                        if (checked) {
                            // Select contact
                            if (!newState[customerId]) {
                                newState[customerId] = [];
                            }
                            if (!newState[customerId].includes(contact.id)) {
                                newState[customerId].push(contact.id);
                            }
                        } else {
                            // Deselect contact
                            if (newState[customerId]) {
                                newState[customerId] = newState[
                                    customerId
                                ].filter((id) => id !== contact.id);
                                if (newState[customerId].length === 0) {
                                    delete newState[customerId];
                                }
                            }
                        }
                    }
                });

                return newState;
            });
        },
        []
    );

    const resetSelection = useCallback(() => {
        setSelectedContactsByCustomer({});
        setSelectRegularContacts(false);
        setSelectEscalatedContacts(false);
    }, []);

    return {
        selectedContactsByCustomer,
        selectRegularContacts,
        selectEscalatedContacts,
        selectionSummary,
        handleContactToggle,
        handleSelectAllForCustomer,
        handleDeselectAllForCustomer,
        handleContactTypeToggle,
        resetSelection,
    };
};
