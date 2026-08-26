import type { ComponentType } from "react";

export const SAMPLE_NOOP_EXTENSION_KEY = "sample_noop";
export const ACCOUNT_10149_EXTENSION_KEY = "account_10149";

export interface BillingExtensionPanelProps {
    accountId: number;
    extensionKey: string;
    extensionConfig: Record<string, unknown>;
    canManage: boolean;
    onConfigChange: (next: Record<string, unknown>) => void;
}

export interface BillingExtensionPanelRegistration {
    key: string;
    label: string;
    Panel: ComponentType<BillingExtensionPanelProps>;
}
