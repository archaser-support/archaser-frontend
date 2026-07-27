import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { ActivityTemplateValidationService } from "./ActivityTemplateValidationService";

export type ActivityType =
    | "SMS"
    | "Email"
    | "Call"
    | "WhatsApp"
    | "Internal"
    | "Resolved"
    | "Dispute"
    | "Promise_to_pay"
    | "Agent";
export type Category =
    | "Automated"
    | "Promise_to_pay"
    | "Dispute"
    | "Agent"
    | "Legal";

export interface ActivitySequence {
    id: number;
    step: number | null;
    active: boolean;
    activity_type: ActivityType;
    category: Category;
    days_from_prev_step: number | null;
    activity_template_id: number | null;
    master_template: boolean | null;
    last_category_step: boolean;
    time_of_day: string | null;
    account_id: number;
    sequence_container_id?: number | null;
}

export interface ActivitySequenceWithRelations extends ActivitySequence {
    ActivitiesTemplate?: {
        id: number;
        name: string;
    } | null;
    Account?: {
        id: number;
        name: string | null;
    };
}

export interface GetAllActivitySequencesParams {
    account_id: number;
}

export interface CreateActivitySequenceData {
    step?: number | null;
    active: boolean;
    activity_type: ActivityType;
    category: Category;
    days_from_prev_step?: number;
    activity_template_id: number;
    master_template?: boolean | null;
    last_category_step?: boolean;
    time_of_day?: string | null; // Keep as optional but will default to "09:00"
    account_id: number;
    sequence_container_id?: number | null;
}

export interface UpdateActivitySequenceData extends CreateActivitySequenceData {
    id: number;
}

export interface ActivitySequenceResponse {
    activitiesSequences: ActivitySequenceWithRelations[];
    totalRecords: number;
}

export class ActivitySequenceService {
    /**
     * Get all activity sequences for a specific sequence container
     */
    async getByContainerId(container_id: number): Promise<ActivitySequenceWithRelations[]> {
        return await prisma.activitiesSequence.findMany({
            where: {
                sequence_container_id: container_id,
            },
            include: {
                ActivitiesTemplate: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                Account: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
            orderBy: {
                step: "asc",
            },
        });
    }

    /**
     * Update the last step flag for a category
     */
    public async updateLastStepFlag(
        account_id: number,
        category: Category,
        sequence_container_id?: number
    ): Promise<void> {
        // Build the where clause with optional sequence_container_id
        const whereClause: Prisma.ActivitiesSequenceWhereInput = {
            account_id,
            category,
            active: true,
        };

        if (sequence_container_id !== undefined) {
            whereClause.sequence_container_id = sequence_container_id;
        }

        // First, reset ALL last_category_step flags for this category and container (including inactive sequences)
        const resetAllWhereClause: Prisma.ActivitiesSequenceWhereInput = {
            account_id,
            category,
            last_category_step: true,
        };

        if (sequence_container_id !== undefined) {
            resetAllWhereClause.sequence_container_id = sequence_container_id;
        }

        await prisma.activitiesSequence.updateMany({
            where: resetAllWhereClause,
            data: {
                last_category_step: false,
                modified_at: new Date(),
            },
        });

        // Get all active sequences - for Automated use logical order (due first, then overdue)
        const activeSequencesRaw = await prisma.activitiesSequence.findMany({
            where: whereClause,
            select: {
                id: true,
                step: true,
                step_type: true,
                days_before_due: true,
            },
        });

        const activeSequences =
            category === "Automated"
                ? [...activeSequencesRaw].sort((a, b) => {
                    const aIsDue = a.step_type === "due";
                    const bIsDue = b.step_type === "due";
                    if (aIsDue !== bIsDue) return aIsDue ? -1 : 1;
                    if (aIsDue && bIsDue) {
                        return (
                            (b.days_before_due ?? -1) -
                            (a.days_before_due ?? -1)
                        );
                    }
                    return (a.step ?? Infinity) - (b.step ?? Infinity);
                })
                : activeSequencesRaw.sort(
                    (a, b) => (a.step ?? Infinity) - (b.step ?? Infinity)
                );

        // Renumber: for Automated, due steps get step=null, overdue get 1,2,3...; for other categories, all get 1,2,3...
        if (category === "Automated") {
            let overdueIndex = 0;
            for (const seq of activeSequences) {
                const isDue = seq.step_type === "due";
                const newStep = isDue ? null : ++overdueIndex;
                if (seq.step !== newStep) {
                    await prisma.activitiesSequence.update({
                        where: { id: seq.id },
                        data: { step: newStep, modified_at: new Date() },
                    });
                }
            }
        } else {
            for (let i = 0; i < activeSequences.length; i++) {
                const newStep = i + 1;
                if (activeSequences[i].step !== newStep) {
                    await prisma.activitiesSequence.update({
                        where: { id: activeSequences[i].id },
                        data: { step: newStep, modified_at: new Date() },
                    });
                }
            }
        }

        // Set the last sequence (highest step number after renumbering) as the last step flag
        if (activeSequences.length > 0) {
            const lastSequence = activeSequences[activeSequences.length - 1];
            await prisma.activitiesSequence.update({
                where: { id: lastSequence.id },
                data: {
                    last_category_step: true,
                    modified_at: new Date(),
                },
            });
        }
    }

    /**
     * For Automated category: when creating a due step, use step=null (due steps are unnumbered).
     * Do not shift existing overdue step numbers; updateLastStepFlag will run after create.
     */
    async getStepForNewDueSequence(
        _account_id: number,
        _sequence_container_id: number,
        _proposedStep: number,
        _days_before_due: number
    ): Promise<number | null> {
        return null;
    }

    /**
     * Create a new activity sequence
     */
    async createActivitySequence(
        data: CreateActivitySequenceData,
        userId?: string
    ): Promise<ActivitySequence> {
        const {
            step,
            active,
            activity_type,
            category,
            days_from_prev_step,
            activity_template_id,
            master_template = false,
            last_category_step = false,
            time_of_day = "09:00", // Changed from null to "09:00"
            account_id,
            sequence_container_id,
        } = data;

        // Automatically set master_template to true for account_id 10013 (master customer)
        const shouldBeMasterTemplate = account_id === 10013 || master_template;

        // Validate required fields (step may be null for Automated due steps)
        if (
            (step !== 0 && step !== null && !step) ||
            active === undefined ||
            active === null ||
            !activity_type ||
            !category ||
            !activity_template_id ||
            !account_id ||
            !sequence_container_id
        ) {
            throw new Error("Missing required fields");
        }

        const stepValue =
            step === null || step === undefined ? null : parseInt(step.toString(), 10);

        // Check for existing records (skip when step is null - multiple due steps can have step null)
        if (stepValue !== null) {
            const existingRecord = await prisma.activitiesSequence.findFirst({
                where: {
                    category,
                    step: stepValue,
                    account_id: parseInt(account_id.toString(), 10),
                    sequence_container_id: parseInt(sequence_container_id.toString(), 10),
                },
            });

            if (existingRecord) {
                throw new Error(
                    "A record with this step number and category already exists for the customer."
                );
            }
        }

        // Validate that the template has content for the customer's default language
        const account = await prisma.account.findUnique({
            where: { id: account_id },
            select: { default_language: true },
        });

        if (account?.default_language) {
            const validation =
                await ActivityTemplateValidationService.validateTemplateForDefaultLanguage(
                    activity_template_id,
                    account_id,
                    account.default_language
                );

            if (!validation.isValid) {
                throw new Error(
                    `Template must have content for the account's default language (${account.default_language}). Please add content for this language or select a different template.`
                );
            }
        }


        // Create the activity sequence
        const newSequence = await prisma.activitiesSequence.create({
            data: {
                step: stepValue,
                active,
                activity_type,
                category,
                days_from_prev_step: days_from_prev_step
                    ? parseInt(days_from_prev_step.toString(), 10)
                    : null,
                activity_template_id: activity_template_id
                    ? parseInt(activity_template_id.toString(), 10)
                    : null,
                master_template: shouldBeMasterTemplate,
                last_category_step,
                account_id: parseInt(account_id.toString(), 10),
                time_of_day,
                sequence_container_id: parseInt(sequence_container_id.toString(), 10),
                created_by: userId,
                modified_by: userId,
            } as any,
            select: {
                id: true,
                step: true,
                active: true,
                activity_type: true,
                category: true,
                days_from_prev_step: true,
                activity_template_id: true,
                master_template: true,
                last_category_step: true,
                time_of_day: true,
                account_id: true,
                sequence_container_id: true,
            },
        });


        // Update the last step flag
        await this.updateLastStepFlag(account_id, category, sequence_container_id);

        return newSequence;
    }

    /**
     * Update an existing activity sequence
     */
    async updateActivitySequence(
        data: UpdateActivitySequenceData,
        userId?: string
    ): Promise<ActivitySequence> {
        const {
            id,
            step,
            active,
            activity_type,
            category,
            days_from_prev_step,
            activity_template_id,
            account_id,
            time_of_day = null,
            sequence_container_id,
        } = data;

        // Validate required fields (step may be null for Automated due steps)
        if (
            !id ||
            (step !== 0 && step !== null && step !== undefined && !step) ||
            active === undefined ||
            active === null ||
            !activity_type ||
            !category ||
            !activity_template_id ||
            !account_id ||
            !sequence_container_id
        ) {
            throw new Error("Missing required fields");
        }

        const stepValue =
            step === null || step === undefined ? null : parseInt(step.toString(), 10);

        // Check for existing records (skip when step is null - multiple due steps can have step null)
        if (stepValue !== null) {
            const existingRecord = await prisma.activitiesSequence.findFirst({
                where: {
                    category,
                    step: stepValue,
                    account_id: parseInt(account_id.toString(), 10),
                    sequence_container_id: parseInt(sequence_container_id.toString(), 10),
                    NOT: { id: parseInt(id.toString(), 10) },
                },
            });

            if (existingRecord) {
                throw new Error(
                    "A record with this step number and category already exists for the customer."
                );
            }
        }

        // Validate that the template has content for the customer's default language
        const account = await prisma.account.findUnique({
            where: { id: account_id },
            select: { default_language: true },
        });

        if (account?.default_language) {
            const validation =
                await ActivityTemplateValidationService.validateTemplateForDefaultLanguage(
                    activity_template_id,
                    account_id,
                    account.default_language
                );

            if (!validation.isValid) {
                throw new Error(
                    `Template must have content for the account's default language (${account.default_language}). Please add content for this language or select a different template.`
                );
            }
        }

        // Update the activity sequence
        const updatedActivitySequence = await prisma.activitiesSequence.update({
            where: { id: parseInt(id.toString(), 10) },
            data: {
                step: stepValue,
                active,
                activity_type,
                category,
                days_from_prev_step: days_from_prev_step
                    ? parseInt(days_from_prev_step.toString(), 10)
                    : null,
                activity_template_id: activity_template_id
                    ? parseInt(activity_template_id.toString(), 10)
                    : null,
                account_id: parseInt(account_id.toString(), 10),
                time_of_day,
                sequence_container_id: parseInt(sequence_container_id.toString(), 10),
                modified_at: new Date(),
                modified_by: userId,
            } as any,
            select: {
                id: true,
                step: true,
                active: true,
                activity_type: true,
                category: true,
                days_from_prev_step: true,
                activity_template_id: true,
                master_template: true,
                last_category_step: true,
                time_of_day: true,
                account_id: true,
                sequence_container_id: true,
            },
        });

        if (!updatedActivitySequence) {
            throw new Error("Activity Sequence not found or failed to update");
        }

        // Update the last step flag
        await this.updateLastStepFlag(account_id, category, sequence_container_id);

        return updatedActivitySequence;
    }
}
