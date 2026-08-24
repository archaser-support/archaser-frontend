import SampleNoopPanel from "./sample_noop/SampleNoopPanel";
import {
    SAMPLE_NOOP_EXTENSION_KEY,
    type BillingExtensionPanelRegistration,
} from "./types";

export { SAMPLE_NOOP_EXTENSION_KEY } from "./types";
export type {
    BillingExtensionPanelProps,
    BillingExtensionPanelRegistration,
} from "./types";

const BILLING_EXTENSION_PANELS: ReadonlyMap<
    string,
    BillingExtensionPanelRegistration
> = new Map([
    [
        SAMPLE_NOOP_EXTENSION_KEY,
        {
            key: SAMPLE_NOOP_EXTENSION_KEY,
            label: "Sample (no-op)",
            Panel: SampleNoopPanel,
        },
    ],
]);

export function listBillingExtensionPanelOptions(): Array<{
    key: string;
    label: string;
}> {
    return Array.from(BILLING_EXTENSION_PANELS.values())
        .map(({ key, label }) => ({ key, label }))
        .sort((a, b) => a.key.localeCompare(b.key));
}

export function getBillingExtensionPanel(
    key: string | null | undefined
): BillingExtensionPanelRegistration | undefined {
    if (!key?.trim()) {
        return undefined;
    }
    return BILLING_EXTENSION_PANELS.get(key.trim());
}
