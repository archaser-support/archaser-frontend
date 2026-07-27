import { DbClient, prisma } from "@/lib/prisma";

/**
 * Re-validate stuck collection periods (Customer.automation_stuck_no_contacts) for an
 * entire account/sequence-container, e.g. after an activity sequence is created or updated.
 */
export async function revalidateStuckCollectionPeriodsForSequence(
    accountId: number,
    sequenceContainerId: number | null,
    dbClient: DbClient = prisma
): Promise<void> {
    // Find all stuck customers (Customer.automation_stuck_no_contacts) with open Automated period in this account/container
    const stuckCollectionPeriods = await dbClient.customerCollectionPeriod.findMany({
        where: {
            current_category: "Automated",
            period_end_date: null,
            Customer: {
                account_id: accountId,
                sequence_container_id: sequenceContainerId,
                automation_stuck_no_contacts: true,
            },
        },
        include: {
            Customer: {
                select: {
                    id: true,
                    account_id: true,
                    type: true,
                    email: true,
                    sequence_container_id: true,
                    Person: {
                        select: {
                            mobile: true,
                        },
                    },
                    Company: {
                        select: {
                            Contact: {
                                select: {
                                    id: true,
                                    receives_standard_reminder: true,
                                    receives_escalated_reminder: true,
                                },
                            },
                        },
                    },
                },
            },
        },
    });

    if (stuckCollectionPeriods.length === 0) {
        return;
    }

    // Get all activity sequences for this account/container
    const activitySequences = await dbClient.activitiesSequence.findMany({
        where: {
            account_id: accountId,
            sequence_container_id: sequenceContainerId,
            category: "Automated",
            active: true,
        },
        orderBy: {
            step: "asc",
        },
    });

    // Re-validate each stuck collection period; update Customer and period
    for (const collectionPeriod of stuckCollectionPeriods) {
        try {
            const currentStep = collectionPeriod.last_automated_step || 0;
            const nextSequence = activitySequences.find((seq) => {
                if (currentStep === -1) {
                    return (seq.step || 0) === 1;
                } else {
                    return (seq.step || 0) > currentStep;
                }
            });

            if (!nextSequence) {
                continue;
            }

            let contacts: Array<{
                id: number;
                receives_standard_reminder: boolean | null;
                receives_escalated_reminder: boolean | null;
            }> = [];

            if (collectionPeriod.Customer.type === "Company") {
                contacts = (collectionPeriod.Customer.Company?.Contact || []).map(
                    (contact) => ({
                        id: contact.id,
                        receives_standard_reminder: contact.receives_standard_reminder,
                        receives_escalated_reminder: contact.receives_escalated_reminder,
                    })
                );
            } else if (collectionPeriod.Customer.email) {
                contacts = [
                    {
                        id: 0,
                        receives_standard_reminder: false,
                        receives_escalated_reminder: false,
                    },
                ];
            }

            const hasMatchingContacts = contacts.some((contact) => {
                const matchesStandard =
                    nextSequence.send_to_standard_contacts &&
                    contact.receives_standard_reminder === true;
                const matchesEscalated =
                    nextSequence.send_to_escalated_contacts &&
                    contact.receives_escalated_reminder === true;
                return matchesStandard || matchesEscalated;
            });

            if (hasMatchingContacts) {
                await dbClient.customer.update({
                    where: { id: collectionPeriod.Customer.id },
                    data: { automation_stuck_no_contacts: false },
                });
                await dbClient.customerCollectionPeriod.update({
                    where: { id: collectionPeriod.id },
                    data: { create_next_activity: true },
                });
            }
        } catch (error) {
            console.error(
                `Error re-validating collection period ${collectionPeriod.id}:`,
                error
            );
        }
    }
}

/**
 * Re-validate stuck collection periods for a specific customer.
 * Uses Customer.automation_stuck_no_contacts; clears it when contacts match
 * or when customer has any valid contact (e.g. due-only stuck).
 */
export async function revalidateStuckCollectionPeriodsForCustomer(
    customerId: number,
    accountId: number,
    dbClient: DbClient = prisma
): Promise<void> {
    const customer = await dbClient.customer.findUnique({
        where: {
            id: customerId,
            automation_stuck_no_contacts: true,
        },
        select: {
            id: true,
            account_id: true,
            type: true,
            email: true,
            sequence_container_id: true,
            Person: {
                select: {
                    mobile: true,
                },
            },
            Company: {
                select: {
                    Contact: {
                        select: {
                            id: true,
                            receives_standard_reminder: true,
                            receives_escalated_reminder: true,
                        },
                    },
                },
            },
            CustomerCollectionPeriod: {
                where: {
                    current_category: "Automated",
                    period_end_date: null,
                },
                select: {
                    id: true,
                    last_automated_step: true,
                },
            },
        },
    });

    if (!customer) {
        return;
    }

    let contacts: Array<{
        id: number;
        receives_standard_reminder: boolean | null;
        receives_escalated_reminder: boolean | null;
    }> = [];

    if (customer.type === "Company") {
        contacts = (customer.Company?.Contact || []).map((contact) => ({
            id: contact.id,
            receives_standard_reminder: contact.receives_standard_reminder,
            receives_escalated_reminder: contact.receives_escalated_reminder,
        }));
    } else if (customer.email) {
        contacts = [
            {
                id: 0,
                receives_standard_reminder: false,
                receives_escalated_reminder: false,
            },
        ];
    }

    if (customer.CustomerCollectionPeriod.length === 0) {
        const hasAnyContact = contacts.length > 0;
        if (hasAnyContact) {
            const clearCustomerFlag = async (txClient: DbClient) => {
                await txClient.customer.update({
                    where: { id: customerId },
                    data: { automation_stuck_no_contacts: false },
                });
            };

            if (dbClient === prisma) {
                await prisma.$transaction(async (tx) => {
                    await clearCustomerFlag(tx as DbClient);
                });
            } else {
                await clearCustomerFlag(dbClient);
            }
        }
        return;
    }

    const activitySequences = await dbClient.activitiesSequence.findMany({
        where: {
            account_id: accountId,
            sequence_container_id: customer.sequence_container_id,
            category: "Automated",
            active: true,
        },
        orderBy: {
            step: "asc",
        },
    });

    if (activitySequences.length === 0) {
        return;
    }

    let hasMatchingContactsForAnyPeriod = false;
    const collectionPeriodIdsToUnlock: number[] = [];
    for (const collectionPeriod of customer.CustomerCollectionPeriod) {
        try {
            const currentStep = collectionPeriod.last_automated_step || 0;
            const nextSequence = activitySequences.find((seq) => {
                if (currentStep === -1) {
                    return (seq.step || 0) === 1;
                }
                return (seq.step || 0) > currentStep;
            });

            if (!nextSequence) {
                continue;
            }

            const hasMatchingContacts = contacts.some((contact) => {
                const matchesStandard =
                    nextSequence.send_to_standard_contacts &&
                    contact.receives_standard_reminder === true;
                const matchesEscalated =
                    nextSequence.send_to_escalated_contacts &&
                    contact.receives_escalated_reminder === true;
                return matchesStandard || matchesEscalated;
            });

            if (hasMatchingContacts) {
                hasMatchingContactsForAnyPeriod = true;
                collectionPeriodIdsToUnlock.push(collectionPeriod.id);
            }
        } catch (error) {
            console.error(
                `Error re-validating collection period ${collectionPeriod.id}:`,
                error
            );
        }
    }

    if (hasMatchingContactsForAnyPeriod) {
        const applyUnlocks = async (txClient: DbClient) => {
            for (const collectionPeriodId of collectionPeriodIdsToUnlock) {
                await txClient.customerCollectionPeriod.update({
                    where: { id: collectionPeriodId },
                    data: { create_next_activity: true },
                });
            }

            await txClient.customer.update({
                where: { id: customerId },
                data: { automation_stuck_no_contacts: false },
            });
        };

        if (dbClient === prisma) {
            await prisma.$transaction(async (tx) => {
                await applyUnlocks(tx as DbClient);
            });
        } else {
            await applyUnlocks(dbClient);
        }
    }
}
