import type { ComponentType } from "react";

export const SAMPLE_NOOP_EXTENSION_KEY = "sample_noop";

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
