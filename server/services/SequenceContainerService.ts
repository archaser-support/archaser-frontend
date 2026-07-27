import { Prisma } from "@prisma/client";

import { DbClient, prisma } from "@/lib/prisma";
import { CategoryType, CreateSequenceContainerData, UpdateSequenceContainerData, CloneSequenceData } from "@/types/SequenceContainer";

// Custom BigInt serializer
function serializeBigInt<T>(obj: T): T {
    return JSON.parse(
        JSON.stringify(obj, (key, value) =>
            typeof value === "bigint" ? value.toString() : value
        )
    );
}

export class SequenceContainerService {
    /**
     * Get sequence containers by customer and category
     */
    async getByCustomerAndCategory(
        account_id: number,
        category: CategoryType,
        includeInactive: boolean = false
    ) {
        const where: any = {
            account_id,
            category,
            is_deleted: false, // Exclude deleted sequences by default
        };

        if (!includeInactive) {
            where.active = true;
        }

        const result = await prisma.sequenceContainer.findMany({
            where,
            include: {
                _count: {
                    select: {
                        ActivitiesSequence: true,
                    },
                },
            },
            orderBy: [
                { is_default: "desc" },
                { name: "asc" },
            ],
        });
        return result;
    }

    /**
     * Get sequence container by ID
     */
    async getById(id: number) {
        return await prisma.sequenceContainer.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        ActivitiesSequence: true,
                    },
                },
            },
        });
    }

    /**
     * Create a new sequence container
     */
    async create(
        data: CreateSequenceContainerData & { account_id: number },
        userId?: string,
        dbClient: DbClient = prisma
    ) {
        const { name, category, account_id, is_default = false, active = true, master_template = false } = data;

        // Validate required fields
        if (!name || !category || !account_id) {
            throw new Error("Name, category, and account_id are required");
        }

        // Automatically set master_template to true for account_id 10013 (master account)
        const shouldBeMasterTemplate = account_id === 10013 || master_template;

        // For non-Automated categories, ensure only one container exists
        if (category !== "Automated") {
            const existingContainer = await dbClient.sequenceContainer.findFirst({
                where: {
                    account_id,
                    category,
                    active: true,
                    is_deleted: false, // Only check non-deleted containers
                },
            });

            if (existingContainer) {
                throw new Error(`Only one active sequence container is allowed for category: ${category}`);
            }
        }

        // If this is set as default, unset other defaults for the same category
        if (is_default) {
            await dbClient.sequenceContainer.updateMany({
                where: {
                    account_id,
                    category,
                    is_default: true,
                    is_deleted: false, // Only update non-deleted containers
                },
                data: {
                    is_default: false,
                },
            });
        }

        const newContainer = await dbClient.sequenceContainer.create({
            data: {
                name,
                category,
                account_id,
                is_default,
                active,
                master_template: shouldBeMasterTemplate,
                ...(userId && { created_by: userId, modified_by: userId }),
            },
            include: {
                _count: {
                    select: {
                        ActivitiesSequence: true,
                    },
                },
            },
        });

        return serializeBigInt(newContainer);
    }

    /**
     * Update a sequence container
     */
    async update(id: number, data: UpdateSequenceContainerData, userId?: string) {
        const { name, active, is_default, master_template } = data;

        // If setting as default, unset other defaults for the same category
        if (is_default) {
            const container = await prisma.sequenceContainer.findUnique({
                where: { id },
                select: { account_id: true, category: true },
            });

            if (container) {
                await prisma.sequenceContainer.updateMany({
                    where: {
                        account_id: container.account_id,
                        category: container.category,
                        is_default: true,
                        NOT: { id },
                    },
                    data: {
                        is_default: false,
                    },
                });
            }
        }

        const updatedContainer = await prisma.sequenceContainer.update({
            where: { id },
            data: {
                ...(name !== undefined && { name }),
                ...(active !== undefined && { active }),
                ...(is_default !== undefined && { is_default }),
                ...(master_template !== undefined && { master_template }),
                ...(userId && { modified_by: userId }),
            },
            include: {
                _count: {
                    select: {
                        ActivitiesSequence: true,
                    },
                },
            },
        });

        return serializeBigInt(updatedContainer);
    }

    /**
     * Delete a sequence container
     */
    async delete(id: number) {
        // Check if container has any activity sequences
        const container = await prisma.sequenceContainer.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        ActivitiesSequence: true,
                    },
                },
            },
        });

        if (!container) {
            throw new Error("Sequence container not found");
        }

        if (container._count.ActivitiesSequence > 0) {
            throw new Error("Cannot delete sequence container that has activity sequences. Please remove all sequences first.");
        }

        await prisma.sequenceContainer.delete({
            where: { id },
        });

        return { success: true };
    }

    /**
     * Clone a sequence container with its activity sequences
     */
    async clone(data: CloneSequenceData & { account_id: number }, userId?: string) {
        const { source_id, new_name, account_id, set_as_default = false } = data;

        // Get the source container with its sequences
        const sourceContainer = await prisma.sequenceContainer.findUnique({
            where: { id: source_id },
            include: {
                ActivitiesSequence: {
                    orderBy: { step: "asc" },
                },
            },
        });

        if (!sourceContainer) {
            throw new Error("Source sequence container not found");
        }

        // Create the new container
        const newContainer = await this.create({
            name: new_name,
            category: sourceContainer.category,
            account_id,
            is_default: set_as_default,
            active: true,
        }, userId);

        // Clone the activity sequences (include step_type and related fields so updateLastStepFlag sort order matches source)
        for (const sequence of sourceContainer.ActivitiesSequence) {
            await prisma.activitiesSequence.create({
                data: {
                    step: sequence.step,
                    active: sequence.active,
                    activity_type: sequence.activity_type as any,
                    category: sequence.category as any,
                    days_from_prev_step: sequence.days_from_prev_step,
                    activity_template_id: sequence.activity_template_id,
                    master_template: sequence.master_template,
                    last_category_step: sequence.last_category_step,
                    time_of_day: sequence.time_of_day,
                    account_id: sequence.account_id,
                    sequence_container_id: newContainer.id,
                    send_to_escalated_contacts: sequence.send_to_escalated_contacts,
                    send_to_standard_contacts: sequence.send_to_standard_contacts,
                    step_type: sequence.step_type,
                    days_before_due: sequence.days_before_due,
                    days_after_start: sequence.days_after_start,
                },
            });
        }

        return newContainer;
    }

    /**
     * Get default sequence container for a category
     */
    async getDefaultByCategory(account_id: number, category: CategoryType) {
        return await prisma.sequenceContainer.findFirst({
            where: {
                account_id,
                category,
                is_default: true,
                active: true,
                is_deleted: false, // Only get non-deleted containers
            },
            include: {
                _count: {
                    select: {
                        ActivitiesSequence: true,
                    },
                },
            },
        });
    }

    /**
     * Clone a sequence container (alias for clone method)
     */
    async cloneSequence(data: CloneSequenceData & { account_id: number }, userId?: string) {
        return await this.clone(data, userId);
    }

    /**
     * Set a sequence container as default
     */
    async setAsDefault(id: number, userId?: string) {
        const container = await prisma.sequenceContainer.findUnique({
            where: { id },
            select: { account_id: true, category: true },
        });

        if (!container) {
            throw new Error("Sequence container not found");
        }

        // Unset other defaults for the same category
        await prisma.sequenceContainer.updateMany({
            where: {
                account_id: container.account_id,
                category: container.category,
                is_default: true,
                is_deleted: false, // Only update non-deleted containers
                NOT: { id },
            },
            data: {
                is_default: false,
            },
        });

        // Set this container as default
        const updatedContainer = await prisma.sequenceContainer.update({
            where: { id },
            data: {
                is_default: true,
                ...(userId && { modified_by: userId }),
            },
            include: {
                _count: {
                    select: {
                        ActivitiesSequence: true,
                    },
                },
            },
        });

        return serializeBigInt(updatedContainer);
    }

    /**
     * Get all master sequence containers (account_id = 10013, active = true, master_template = true)
     */
    async getMasterContainers(
        dbClient: DbClient = prisma
    ) {
        return await dbClient.sequenceContainer.findMany({
            where: {
                account_id: 10013,
                active: true,
                master_template: true,
                is_deleted: false, // Only get non-deleted containers
            },
            include: {
                _count: {
                    select: {
                        ActivitiesSequence: true,
                    },
                },
            },
            orderBy: [
                { category: "asc" },
                { is_default: "desc" },
                { name: "asc" },
            ],
        });
    }

    /**
     * Get usage information for a sequence container (how many customers are using it)
     */
    async getUsage(containerId: number) {
        try {
            // Count how many customers are using this sequence container
            const customerCount = await prisma.customer.count({
                where: {
                    sequence_container_id: containerId,
                },
            });

            // Get list of connected customers (customers) if any
            const connectedCustomers = await prisma.customer.findMany({
                where: {
                    sequence_container_id: containerId,
                },
                select: {
                    id: true,
                    customer_number: true,
                                // Note: Account removed from Customer select since Customer doesn't have Account relation
                                // Fetch Account separately using customer.account_id if needed
                },
                take: 10, // Limit to first 10 for performance
            });

            return {
                connectedCustomers: connectedCustomers,
                totalCount: customerCount,
            };
        } catch (error: any) {
            throw error;
        }
    }

    /**
     * Create default sequence containers for a new customer by copying master containers
     */
    async createDefaultContainersForCustomer(
        accountId: number,
        dbClient: DbClient = prisma
    ) {
        // Get all master containers
        const masterContainers = await this.getMasterContainers(dbClient);

        if (masterContainers.length === 0) {
            // If no master containers exist, create basic default containers for each category
            const categories: CategoryType[] = ["Automated", "Promise_to_pay", "Dispute", "Agent", "Legal"];

            for (const category of categories) {
                await this.create({
                    name: `Default ${category}`,
                    category,
                    account_id: accountId,
                    is_default: true,
                    active: true,
                    master_template: false,
                }, undefined, dbClient);
            }
            return;
        }

        // Create new containers based on master containers
        const containerMap = new Map<number, number>(); // masterContainerId -> newContainerId

        for (const masterContainer of masterContainers) {
            const newContainer = await this.create({
                name: masterContainer.name,
                category: masterContainer.category,
                account_id: accountId,
                is_default: masterContainer.is_default,
                active: true,
                master_template: false, // New containers are never master templates
            }, undefined, dbClient);

            containerMap.set(masterContainer.id, newContainer.id);
        }

        return containerMap;
    }

    /**
     * Migrate all customers from one sequence container to another
     * This is only needed when deleting a sequence container that has connected customers
     */
    async migrateCustomersToReplacement(sourceContainerId: number, replacementContainerId: number) {
        try {
            // Verify both containers exist
            const sourceContainer = await prisma.sequenceContainer.findUnique({
                where: { id: sourceContainerId }
            });

            const replacementContainer = await prisma.sequenceContainer.findUnique({
                where: { id: replacementContainerId }
            });

            if (!sourceContainer) {
                throw new Error(`Source sequence container ${sourceContainerId} not found`);
            }

            if (!replacementContainer) {
                throw new Error(`Replacement sequence container ${replacementContainerId} not found`);
            }

            // Get detailed list of customers that will be migrated
            const customersToMigrate = await prisma.customer.findMany({
                where: {
                    sequence_container_id: sourceContainerId,
                },
                select: {
                    id: true,
                    customer_number: true,
                    sequence_container_id: true,
                                // Note: Account removed from Customer select since Customer doesn't have Account relation
                                // Fetch Account separately using customer.account_id if needed
                },
            });

            if (customersToMigrate.length === 0) {
                return { migratedCount: 0 };
            }

            // Update all customers to use the replacement sequence container
            const updateResult = await prisma.customer.updateMany({
                where: {
                    sequence_container_id: sourceContainerId,
                },
                data: {
                    sequence_container_id: replacementContainerId,
                },
            });

            return { migratedCount: updateResult.count };
        } catch (error: any) {
            throw error;
        }
    }

    /**
     * Soft delete a sequence container by marking it as deleted
     * This preserves the record for future analysis while removing it from the UI
     */
    async softDelete(containerId: number) {
        try {
            // Verify container exists and is not already deleted
            const container = await prisma.sequenceContainer.findUnique({
                where: { id: containerId }
            });

            if (!container) {
                throw new Error(`Sequence container ${containerId} not found`);
            }

            if (container.is_deleted) {
                throw new Error(`Sequence container ${containerId} is already deleted`);
            }

            // Count related records for logging
            const sequenceCount = await prisma.activitiesSequence.count({
                where: { sequence_container_id: containerId }
            });

            const activityCount = await prisma.activity.count({
                where: {
                    ActivitiesSequence: {
                        sequence_container_id: containerId
                    }
                }
            });

            const customerCount = await prisma.customer.count({
                where: { sequence_container_id: containerId }
            });

            // Mark the container as deleted
            await prisma.sequenceContainer.update({
                where: { id: containerId },
                data: { is_deleted: true }
            });

            return {
                deletedSequences: sequenceCount,
                affectedActivities: activityCount,
                affectedCustomers: customerCount
            };
        } catch (error: any) {
            throw error;
        }
    }

    /**
     * Delete a sequence container with proper cascading (now using soft delete)
     * The database will automatically handle:
     * - Deleting all related ActivitiesSequence records (CASCADE)
     * - Setting activity_sequence_id to NULL in Activity records (SET NULL)
     * - Setting sequence_container_id to NULL in Customer records (SET NULL) - unless skipCustomerConstraint is true
     */
    async deleteWithCascade(containerId: number, skipCustomerConstraint: boolean = false) {
        try {
            // Verify container exists
            const container = await prisma.sequenceContainer.findUnique({
                where: { id: containerId }
            });

            if (!container) {
                throw new Error(`Sequence container ${containerId} not found`);
            }

            if (container.is_deleted) {
                throw new Error(`Sequence container ${containerId} is already deleted`);
            }

            // Count related records before deletion for logging
            const sequenceCount = await prisma.activitiesSequence.count({
                where: { sequence_container_id: containerId }
            });

            const activityCount = await prisma.activity.count({
                where: {
                    ActivitiesSequence: {
                        sequence_container_id: containerId
                    }
                }
            });

            const customerCount = await prisma.customer.count({
                where: { sequence_container_id: containerId }
            });

            // Perform soft delete instead of hard delete
            await prisma.sequenceContainer.update({
                where: { id: containerId },
                data: { is_deleted: true }
            });

            return {
                deletedSequences: sequenceCount,
                affectedActivities: activityCount,
                affectedCustomers: skipCustomerConstraint ? 0 : customerCount
            };
        } catch (error: any) {
            throw error;
        }
    }
}