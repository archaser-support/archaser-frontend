export type CategoryType =
    | "Automated"
    | "Promise_to_pay"
    | "Dispute"
    | "Agent"
    | "Legal";

/**
 * SequenceContainer represents a named collection of activity sequences.
 * 
 * IMPORTANT: Only the "Automated" category supports multiple sequence containers per customer.
 * All other categories (Promise_to_pay, Dispute, Agent, Legal) are limited to one sequence container per customer.
 */
export interface SequenceContainer {
    id: number;
    name: string;
    category: CategoryType;
    account_id: number;
    is_default: boolean;
    active: boolean;
    master_template: boolean;
    is_deleted: boolean;
    created_at: Date;
    modified_at: Date;
    _count?: {
        ActivitiesSequence: number;
    };
}

export interface SequenceContainerWithSteps extends SequenceContainer {
    ActivitiesSequence: Array<{
        id: number;
        step: number | null;
        active: boolean;
        activity_type: string;
        category: string;
        days_from_prev_step: number | null;
        activity_template_id: number | null;
        time_of_day: string | null;
        send_to_escalated_contacts: boolean | null;
        send_to_standard_contacts: boolean | null;
        sequence_container_id: number | null;
        ActivitiesTemplate?: {
            id: number;
            name: string;
        } | null;
    }>;
}

export interface CreateSequenceContainerData {
    name: string;
    category: CategoryType;
    is_default?: boolean;
    active?: boolean;
    master_template?: boolean;
}

export interface UpdateSequenceContainerData {
    name?: string;
    active?: boolean;
    is_default?: boolean;
    master_template?: boolean;
}

export interface CloneSequenceData {
    source_id: number;
    new_name: string;
    set_as_default?: boolean;
}
