"use client";

import React, {
    createContext,
    useContext,
    useState,
    ReactNode,
    useEffect,
    useCallback,
} from "react";
import { SingleValue } from "react-select";

import { DisputeReason } from "@/types/DisputeReason";
import { Invoice } from "@/types/Invoice";

type CallType = "incoming" | "outgoing" | null;

export interface BusinessHoursWarningData {
    isOutsideBusinessHours: boolean;
    contactLocalTime: string;
    contactTimezone: string;
}

type OptionType = {
    value: string;
    label: string;
    name: string;
    mobile?: string | null;
};

type InvoiceOption = {
    value: string;
    label: string;
    id: number;
    invoice_number: string;
};

// type OutcomeOption = { value: string; label: string };
const outcomeOptions = [
    "no_answer",
    "bad_number",
    "schedule_follow_up",
    "promise_to_pay",
    "make_payment",
    "open_dispute",
    "add_new_contact",
    "general",
    "move_to_legal",
    "generic_comment",
] as const;

export type Outcome = (typeof outcomeOptions)[number];

export type OutcomeOption = {
    value: Outcome;
    label: string;
};

export const outcomeSelectOptions: OutcomeOption[] = outcomeOptions.map(
    (val) => ({
        value: val,
        label: val,
    })
);

interface AgentPortalContextType {
    isOpen: boolean;
    toggleOpen: () => void;
    isCalling: boolean;
    setIsCalling: (val: boolean) => void;
    callType: CallType;
    setCallType: (val: CallType) => void;
    resetPortal: () => void;

    selectedContact: SingleValue<OptionType>;
    setSelectedContact: (val: SingleValue<OptionType>) => void;

    selectedOutcome: SingleValue<OutcomeOption>;
    setSelectedOutcome: (val: SingleValue<OutcomeOption>) => void;

    selectedDate: Date | null;
    setSelectedDate: (val: Date | null) => void;

    followUpDate: Date | null;
    setFollowUpDate: (val: Date | null) => void;

    comment: string;
    setComment: (val: string) => void;

    showCalendar: boolean;
    setShowCalendar: (val: boolean) => void;

    disputedInvoices: InvoiceOption[];
    setDisputedInvoices: (val: InvoiceOption[]) => void;

    disputeReason: DisputeReason | null;
    setDisputeReason: (val: DisputeReason | null) => void;

    elapsedTime: number;
    setElapsedTime: React.Dispatch<React.SetStateAction<number>>;

    startTime: Date | null;
    setStartTime: (val: Date | null) => void;

    hasUnloggedCall: boolean;
    setHasUnloggedCall: (val: boolean) => void;

    businessHoursWarning: BusinessHoursWarningData | null;
    setBusinessHoursWarning: (val: BusinessHoursWarningData | null) => void;
}

const AgentPortalContext = createContext<AgentPortalContextType | undefined>(
    undefined
);

export const AgentPortalProvider = ({ children }: { children: ReactNode }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isCalling, setIsCalling] = useState(false);
    const [callType, setCallType] = useState<CallType>(null);

    const [selectedContact, setSelectedContact] =
        useState<SingleValue<OptionType>>(null);
    const [selectedOutcome, setSelectedOutcome] =
        useState<SingleValue<OutcomeOption>>(null);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [followUpDate, setFollowUpDate] = useState<Date | null>(null);
    const [comment, setComment] = useState("");
    const [showCalendar, setShowCalendar] = useState(false);
    const [disputedInvoices, setDisputedInvoices] = useState<InvoiceOption[]>(
        []
    );
    const [disputeReason, setDisputeReason] = useState<DisputeReason | null>(
        null
    );
    const [elapsedTime, setElapsedTime] = useState(0);
    const [startTime, setStartTime] = useState<Date | null>(null);
    const [hasUnloggedCall, setHasUnloggedCall] = useState(false);
    const [businessHoursWarning, setBusinessHoursWarning] =
        useState<BusinessHoursWarningData | null>(null);

    const toggleOpen = useCallback(() => {
        setIsOpen((prev) => !prev);
    }, []);

    const resetPortal = () => {
        setIsOpen(false);
        setIsCalling(false);
        setCallType(null);

        setSelectedContact(null);
        setSelectedOutcome(null);
        setSelectedDate(null);
        setFollowUpDate(null);
        setComment("");
        setShowCalendar(false);
        setDisputedInvoices([]);
        setDisputeReason(null);
        setElapsedTime(0);
        setStartTime(null);
        setHasUnloggedCall(false);
        setBusinessHoursWarning(null);
    };

    return (
        <AgentPortalContext.Provider
            value={{
                isOpen,
                toggleOpen,
                isCalling,
                setIsCalling,
                callType,
                setCallType,
                resetPortal,
                selectedContact,
                setSelectedContact,
                selectedOutcome,
                setSelectedOutcome,
                selectedDate,
                setSelectedDate,
                followUpDate,
                setFollowUpDate,
                comment,
                setComment,
                showCalendar,
                setShowCalendar,
                disputedInvoices,
                setDisputedInvoices,
                disputeReason,
                setDisputeReason,
                elapsedTime,
                setElapsedTime,
                startTime,
                setStartTime,
                hasUnloggedCall,
                setHasUnloggedCall,
                businessHoursWarning,
                setBusinessHoursWarning,
            }}
        >
            {children}
        </AgentPortalContext.Provider>
    );
};

export const useAgentPortal = () => {
    const context = useContext(AgentPortalContext);
    if (!context)
        throw new Error(
            "useAgentPortal must be used within AgentPortalProvider"
        );
    return context;
};
