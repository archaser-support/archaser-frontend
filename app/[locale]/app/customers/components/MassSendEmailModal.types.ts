import { ActivityTemplate } from "@/types/ActivitiesTemplate";
import { Contact } from "@/types/contact";
import { Customer } from "@/types/Customer";

export interface CustomerRow {
    id: number;
    name: string;
    customer_number?: string;
    type?: "Person" | "Company";
    collection_status?: "Active" | "Inactive";
    company_id?: number;
    raw?: any;
    language?: string;
}

export interface MassSendEmailModalProps {
    isOpen: boolean;
    closeModal: () => void;
    // Support both single customer and multiple customers
    customer?: Customer; // For single customer mode
    selectedRows?: CustomerRow[]; // For multi customer mode
    onUpdateComplete?: () => void;
    refreshTimeline?: () => void; // For single customer mode
}

export interface SendResult {
    customerId: number;
    customerName: string;
    success: boolean;
    contactCount?: number;
    error?: string;
}

export interface FormErrors {
    subject?: string;
    emailBody?: string;
    contacts?: string;
}

export interface SelectionSummary {
    customerCount: number;
    totalContacts: number;
}

export interface SendProgress {
    current: number;
    total: number;
    currentCustomerName?: string;
}

export interface ContactWithCustomer extends Contact {
    customerId: number;
    customerName: string;
}
