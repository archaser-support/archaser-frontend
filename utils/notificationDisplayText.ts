import moment from "moment";

export interface NotificationDisplayInput {
    type: string;
    title: string;
    message: string;
    metadata?: Record<string, unknown>;
}

type TranslateFn = (
    key: string,
    options?: Record<string, unknown>
) => string;

const DISPUTE_TYPES = new Set(["Primary", "dispute"]);
const CUSTOMER_ASSIGNMENT_ACTIONS = new Set([
    "assigned",
    "reassigned",
    "unassigned",
]);

function formatFollowUpTime(
    followUpTime: string | undefined,
    language: string
): string {
    if (!followUpTime) return "";
    const when = moment(followUpTime);
    if (!when.isValid()) return followUpTime;
    when.locale(language === "he" ? "he" : "en");
    return when.format("DD.MM.YYYY, HH:mm");
}

function formatSnoozeTime(
    snoozedUntil: string | undefined,
    language: string
): string {
    if (!snoozedUntil) return "";
    const when = moment(snoozedUntil);
    if (!when.isValid()) return snoozedUntil;
    when.locale(language === "he" ? "he" : "en");
    return when.format("DD.MM.YYYY, HH:mm");
}

function getFollowUpNotificationText(
    notification: NotificationDisplayInput,
    field: "title" | "message",
    t: TranslateFn,
    language: string
): string | null {
    const m = notification.metadata;
    if (m?.followUpReminder !== true) return null;

    const agentName = (m.agentName as string) || "";
    const ownerName = (m.ownerName as string) || "";
    const customerName = (m.customerName as string) || "";
    const completedByName = (m.completedByName as string) || "";
    const followUpTime = formatFollowUpTime(
        m.followUpTime as string | undefined,
        language
    );
    const snoozedUntil = formatSnoozeTime(
        m.snoozedUntil as string | undefined,
        language
    );

    if (m.dismissedAt) {
        return field === "title"
            ? t("follow_up.dismissed_title", {
                  ns: "notifications",
                  defaultValue: notification.title,
              })
            : t("follow_up.dismissed_message", {
                  ns: "notifications",
                  customerName:
                      customerName ||
                      t("follow_up.customer_fallback", {
                          ns: "notifications",
                          defaultValue: "customer",
                      }),
                  defaultValue: notification.message,
              });
    }

    if (m.snoozedUntil) {
        return field === "title"
            ? t("follow_up.snoozed_title", {
                  ns: "notifications",
                  defaultValue: notification.title,
              })
            : t("follow_up.snoozed_message", {
                  ns: "notifications",
                  snoozedUntil,
                  defaultValue: notification.message,
              });
    }

    if (m.completedById || m.completedByName) {
        if (field === "title") {
            return completedByName
                ? t("follow_up.complete_by_agent_title", {
                      ns: "notifications",
                      agentName: completedByName,
                      defaultValue: notification.title,
                  })
                : t("follow_up.complete_title", {
                      ns: "notifications",
                      defaultValue: notification.title,
                  });
        }
        return t("follow_up.complete_message", {
            ns: "notifications",
            customerName:
                customerName ||
                t("follow_up.customer_fallback", {
                    ns: "notifications",
                    defaultValue: "customer",
                }),
            defaultValue: notification.message,
        });
    }

    if (field === "title") {
        return agentName
            ? t("follow_up.scheduled_by_agent_title", {
                  ns: "notifications",
                  agentName,
                  defaultValue: notification.title,
              })
            : t("follow_up.scheduled_title", {
                  ns: "notifications",
                  defaultValue: notification.title,
              });
    }

    if (ownerName) {
        return t("follow_up.scheduled_message_with_owner", {
            ns: "notifications",
            followUpTime,
            ownerName,
            defaultValue: notification.message,
        });
    }

    return t("follow_up.scheduled_message", {
        ns: "notifications",
        followUpTime,
        defaultValue: notification.message,
    });
}

function getTemplateMissingNotificationText(
    notification: NotificationDisplayInput,
    field: "title" | "message",
    t: TranslateFn
): string | null {
    const m = notification.metadata;
    if (
        !m?.customerLanguage ||
        !m?.channel ||
        m?.disputeId != null ||
        m?.followUpReminder === true ||
        m?.invoiceId != null
    ) {
        return null;
    }

    const customerName = (m.customerName as string) || "";
    const customerLanguage = (m.customerLanguage as string) || "";
    const channel = (m.channel as string) || "";

    return field === "title"
        ? t("template_missing.title", {
              ns: "notifications",
              defaultValue: notification.title,
          })
        : t("template_missing.message", {
              ns: "notifications",
              channel,
              customerName,
              customerLanguage,
              defaultValue: notification.message,
          });
}

function getAccountLockNotificationText(
    notification: NotificationDisplayInput,
    field: "title" | "message",
    t: TranslateFn
): string | null {
    const m = notification.metadata;
    if (m?.type !== "account_lock") return null;

    const lockedUserEmail = (m.lockedUserEmail as string) || "";
    const failedAttempts = String(m.failedAttempts ?? "");
    const lockTime = (m.lockTime as string) || "";

    return field === "title"
        ? t("account_lock.title", {
              ns: "notifications",
              defaultValue: notification.title,
          })
        : t("account_lock.message", {
              ns: "notifications",
              lockedUserEmail,
              failedAttempts,
              lockTime,
              defaultValue: notification.message,
          });
}

function getDisputeNotificationText(
    notification: NotificationDisplayInput,
    field: "title" | "message",
    t: TranslateFn,
    currentUserId?: string
): string | null {
    const m = notification.metadata;
    const action = m?.action;
    if (
        !action ||
        typeof action !== "string" ||
        !DISPUTE_TYPES.has(notification.type) ||
        m?.disputeId == null
    ) {
        return null;
    }

    const customerName = (m.customerName as string) || "";
    const disputeId = String(m.disputeId ?? "");
    const assignedBy = (m.assignedBy as string) || "";
    const assignedToName = (m.assignedToName as string) || "";
    const assignedToUserId = (m.assignedToUserId as string) || "";

    if (action === "assigned" && assignedBy) {
        const isAssignee =
            !!currentUserId && assignedToUserId === currentUserId;

        if (field === "title") {
            return isAssignee
                ? t("dispute.assigned_to_you_title", {
                      ns: "notifications",
                      assignedBy,
                      customerName,
                      defaultValue: notification.title,
                  })
                : t("dispute.assigned_to_other_title", {
                      ns: "notifications",
                      assignedBy,
                      assigneeName: assignedToName,
                      customerName,
                      defaultValue: notification.title,
                  });
        }

        return isAssignee
            ? t("dispute.assigned_to_you_message", {
                  ns: "notifications",
                  assignedBy,
                  disputeId,
                  defaultValue: notification.message,
              })
            : t("dispute.assigned_to_other_message", {
                  ns: "notifications",
                  assignedBy,
                  assigneeName: assignedToName,
                  disputeId,
                  defaultValue: notification.message,
              });
    }

    if (field === "title") {
        return t(`dispute.${action}`, {
            ns: "notifications",
            defaultValue: notification.title,
        });
    }

    return t(`dispute.${action}_message`, {
        ns: "notifications",
        customerName,
        disputeId,
        defaultValue: notification.message,
    });
}

function getInvoiceNotificationText(
    notification: NotificationDisplayInput,
    field: "title" | "message",
    t: TranslateFn
): string | null {
    const m = notification.metadata;
    const action = m?.action;
    if (!action || typeof action !== "string" || m?.invoiceId == null) {
        return null;
    }

    const invoiceNumber = (m.invoiceNumber as string) || String(m.invoiceId);
    const customerName = (m.customerName as string) || "";

    return field === "title"
        ? t(`invoice.${action}`, {
              ns: "notifications",
              defaultValue: notification.title,
          })
        : t(`invoice.${action}_message`, {
              ns: "notifications",
              invoiceNumber,
              customerName,
              defaultValue: notification.message,
          });
}

function getActivityNotificationText(
    notification: NotificationDisplayInput,
    field: "title" | "message",
    t: TranslateFn
): string | null {
    const m = notification.metadata;
    const action = m?.action;
    if (!action || typeof action !== "string" || m?.activityId == null) {
        return null;
    }

    const activityType = (m.activityType as string) || "";
    const customerId = String(m.customerId ?? "");

    return field === "title"
        ? t(`activity.${action}`, {
              ns: "notifications",
              defaultValue: notification.title,
          })
        : t(`activity.${action}_message`, {
              ns: "notifications",
              activityType,
              customerId,
              defaultValue: notification.message,
          });
}

function getCustomerAssignmentNotificationText(
    notification: NotificationDisplayInput,
    field: "title" | "message",
    t: TranslateFn
): string | null {
    const m = notification.metadata;
    const action = m?.action;
    if (
        !action ||
        typeof action !== "string" ||
        !CUSTOMER_ASSIGNMENT_ACTIONS.has(action) ||
        m?.customerId == null ||
        m?.disputeId != null ||
        m?.invoiceId != null
    ) {
        return null;
    }

    const customerId = String(m.customerId ?? "");

    return field === "title"
        ? t(`customer_assignment.${action}`, {
              ns: "notifications",
              defaultValue: notification.title,
          })
        : t(`customer_assignment.${action}_message`, {
              ns: "notifications",
              customerId,
              defaultValue: notification.message,
          });
}

function getOverdueNotificationText(
    notification: NotificationDisplayInput,
    field: "title" | "message",
    t: TranslateFn
): string | null {
    const m = notification.metadata;
    if (m?.overdueCount == null) return null;

    const customerId = String(m.customerId ?? "");
    const overdueCount = String(m.overdueCount ?? "");
    const totalAmount = String(m.totalAmount ?? "");

    return field === "title"
        ? t("overdue.title", {
              ns: "notifications",
              defaultValue: notification.title,
          })
        : t("overdue.message", {
              ns: "notifications",
              customerId,
              overdueCount,
              totalAmount,
              defaultValue: notification.message,
          });
}

function getPaymentNotificationText(
    notification: NotificationDisplayInput,
    field: "title" | "message",
    t: TranslateFn
): string | null {
    const m = notification.metadata;
    if (m?.paymentAmount == null) return null;

    const customerId = String(m.customerId ?? "");
    const paymentAmount = String(m.paymentAmount ?? "");
    const invoiceCount = String(m.invoiceCount ?? "");

    return field === "title"
        ? t("payment.title", {
              ns: "notifications",
              defaultValue: notification.title,
          })
        : t("payment.message", {
              ns: "notifications",
              customerId,
              paymentAmount,
              invoiceCount,
              defaultValue: notification.message,
          });
}

/**
 * Resolve notification title/message for display using metadata and i18n.
 * Falls back to stored DB strings when no known pattern matches.
 */
export function getLocalizedNotificationText(
    notification: NotificationDisplayInput,
    field: "title" | "message",
    t: TranslateFn,
    options?: { language?: string; currentUserId?: string }
): string {
    const language = options?.language ?? "en";
    const currentUserId = options?.currentUserId;

    const resolvers = [
        () =>
            getFollowUpNotificationText(notification, field, t, language),
        () => getTemplateMissingNotificationText(notification, field, t),
        () => getAccountLockNotificationText(notification, field, t),
        () =>
            getDisputeNotificationText(
                notification,
                field,
                t,
                currentUserId
            ),
        () => getInvoiceNotificationText(notification, field, t),
        () => getActivityNotificationText(notification, field, t),
        () =>
            getCustomerAssignmentNotificationText(notification, field, t),
        () => getOverdueNotificationText(notification, field, t),
        () => getPaymentNotificationText(notification, field, t),
    ];

    for (const resolve of resolvers) {
        const text = resolve();
        if (text != null) return text;
    }

    return field === "title" ? notification.title : notification.message;
}
