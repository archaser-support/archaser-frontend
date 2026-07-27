/** Display label: insurer name + policy number when insurer is set. */
export function formatPolicyLabel(policy: {
    policy_number?: string | null;
    insurer_name?: string | null;
}): string {
    const number = String(policy.policy_number ?? "").trim();
    const insurer = String(policy.insurer_name ?? "").trim();
    if (insurer && number) {
        return `${insurer} – ${number}`;
    }
    return number || insurer || "—";
}
