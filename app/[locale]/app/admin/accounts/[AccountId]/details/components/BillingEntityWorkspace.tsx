"use client";

import {
    Alert,
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Box,
    Card,
    CardContent,
    FormControlLabel,
    Switch,
    Tab,
    Tabs,
    Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import {
    ExpandMore as ExpandMoreIcon,
    Psychology as PsychologyIcon,
} from "@mui/icons-material";
import type { ImportType } from "@/types/db";
import { memo, type MutableRefObject, type Ref } from "react";

import ConnectorFieldMapper, {
    type ConnectorFieldMapperHandle,
} from "@/shared/layout-components/import/ConnectorFieldMapper";
import ConnectorEntityPullFilterEditor, {
    type ConnectorEntityPullFilterEditorHandle,
} from "@/shared/layout-components/import/ConnectorEntityPullFilterEditor";
import ConnectorPreviewSyncResults from "@/shared/layout-components/import/ConnectorPreviewSyncResults";
import type {
    BillingConnectorConfig,
    PreviewSyncResponse,
} from "@/shared/services/billingConnectorService";
import type { ClearBeforeImportSessionState } from "@/shared/services/billingConnectorClearBeforeImport";
import {
    ENTITY_OPTIONS,
    isClearBeforeImportEntity,
} from "./billingIntegrationConstants";
import { getBillingAccordionStyles } from "./billingAccordionStyles";
import {
    accountCardSx,
    accountCardTitleSx,
    accountSectionIconSx,
} from "../accountCardStyles";

export interface BillingEntityWorkspaceProps {
    canManage: boolean;
    accountId: number;
    expanded: boolean;
    onExpandedChange: (expanded: boolean) => void;
    entitiesForMapping: ImportType[];
    allEnabledMappingsComplete: boolean;
    enabledEntities: ImportType[];
    selectedMappingEntityTab: number;
    onMappingEntityTabChange: (value: number) => void;
    entityWorkspaceTab: "mapping" | "pullFilter" | "preview";
    onEntityWorkspaceTabChange: (value: "mapping" | "pullFilter" | "preview") => void;
    entityTabsRef: Ref<HTMLDivElement | null>;
    onToggleEntity: (entity: ImportType) => void;
    persistEnabledEntitiesPending: boolean;
    clearBeforeImportSession: ClearBeforeImportSessionState;
    onClearBeforeImportEntityChange: (
        entity: ImportType,
        checked: boolean
    ) => void;
    previewResult: PreviewSyncResponse | null;
    config: BillingConnectorConfig;
    mapperRefs: MutableRefObject<
        Partial<Record<ImportType, ConnectorFieldMapperHandle | null>>
    >;
    pullFilterRefs: MutableRefObject<
        Partial<Record<ImportType, ConnectorEntityPullFilterEditorHandle | null>>
    >;
    handleEntitySetChange: (
        importType: ImportType,
        value: string | null
    ) => Promise<void>;
    onRefreshEntitySetCatalog: () => Promise<unknown>;
    isRefreshingEntitySetCatalog: boolean;
    handleMappingCompleteness: (entity: ImportType, isComplete: boolean) => void;
    handleEntityConfigDirtyChange: (dirty: boolean) => void;
    onPullFilterSaved: (saved: BillingConnectorConfig) => void;
}

const BillingEntityWorkspace = memo(function BillingEntityWorkspace({
    canManage,
    accountId,
    expanded,
    onExpandedChange,
    entitiesForMapping,
    allEnabledMappingsComplete,
    enabledEntities,
    selectedMappingEntityTab,
    onMappingEntityTabChange,
    entityWorkspaceTab,
    onEntityWorkspaceTabChange,
    entityTabsRef,
    onToggleEntity,
    persistEnabledEntitiesPending,
    clearBeforeImportSession,
    onClearBeforeImportEntityChange,
    previewResult,
    config,
    mapperRefs,
    pullFilterRefs,
    handleEntitySetChange,
    onRefreshEntitySetCatalog,
    isRefreshingEntitySetCatalog,
    handleMappingCompleteness,
    handleEntityConfigDirtyChange,
    onPullFilterSaved,
}: BillingEntityWorkspaceProps) {
    const theme = useTheme();
    const pillRadiusPx = `${theme.appButton.sizeMedium.borderRadius}px`;
    const {
        accordionSx: billingAccordionSx,
        summarySx: billingAccordionSummarySx,
        detailsSx: billingAccordionDetailsSx,
        contentSx: billingAccordionContentSx,
    } = getBillingAccordionStyles(pillRadiusPx);

    return (
                        <Card elevation={0} sx={accountCardSx}>
                            <Accordion
                                disableGutters
                                elevation={0}
                                expanded={expanded}
                                onChange={(_, next) => onExpandedChange(next)}
                                sx={billingAccordionSx}
                            >
                                <AccordionSummary
                                    expandIcon={<ExpandMoreIcon />}
                                    sx={billingAccordionSummarySx(expanded)}
                                >
                                    <PsychologyIcon sx={accountSectionIconSx} />
                                    <Box sx={{ minWidth: 0, flex: 1 }}>
                                        <Typography
                                            variant="subtitle1"
                                            sx={accountCardTitleSx}
                                        >
                                            Field mapping
                                        </Typography>
                                        <Typography
                                            variant="body2"
                                            color="text.secondary"
                                            sx={{ mt: 0.25 }}
                                        >
                                            {entitiesForMapping.length === 0
                                                ? "Enable entities to map fields and pull filters."
                                                : allEnabledMappingsComplete
                                                  ? `${entitiesForMapping.length} entit${entitiesForMapping.length === 1 ? "y" : "ies"} mapped · pull filters and preview available.`
                                                  : `Map fields for ${entitiesForMapping.length} enabled entit${entitiesForMapping.length === 1 ? "y" : "ies"}.`}
                                        </Typography>
                                    </Box>
                                </AccordionSummary>
                                <AccordionDetails sx={billingAccordionDetailsSx}>
                                    <CardContent sx={billingAccordionContentSx}>
                                <Box>
                                    {entitiesForMapping.length === 0 && (
                                        <Alert severity="info" sx={{ mb: 2 }}>
                                            No entities are enabled. Turn on a switch
                                            under a tab to include that entity in sync.
                                        </Alert>
                                    )}
                                    <Box ref={entityTabsRef}>
                                    <Tabs
                                        value={selectedMappingEntityTab}
                                        onChange={(_, value) =>
                                            onMappingEntityTabChange(value)
                                        }
                                        variant="scrollable"
                                        scrollButtons="auto"
                                    >
                                        {ENTITY_OPTIONS.map((opt) => {
                                            const entityEnabled =
                                                enabledEntities.includes(opt.value);
                                            return (
                                                <Tab
                                                    key={opt.value}
                                                    label={opt.label}
                                                    sx={{
                                                        color: entityEnabled
                                                            ? "primary.main"
                                                            : "text.disabled",
                                                        "&.Mui-selected": {
                                                            color: entityEnabled
                                                                ? "primary.main"
                                                                : "text.disabled",
                                                        },
                                                    }}
                                                />
                                            );
                                        })}
                                    </Tabs>
                                    </Box>
        
                                    {ENTITY_OPTIONS.map((opt, index) => {
                                        const entity = opt.value;
                                        const entityEnabled =
                                            enabledEntities.includes(entity);
                                        const previewEntity =
                                            previewResult?.entities.find(
                                                (row) =>
                                                    row.import_type === entity
                                            );
                                        return (
                                        <Box
                                            key={entity}
                                            role="tabpanel"
                                            hidden={selectedMappingEntityTab !== index}
                                            sx={{ pt: 2 }}
                                        >
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    flexWrap: "wrap",
                                                    alignItems: "center",
                                                    gap: 2,
                                                    mb: entityEnabled ? 2 : 1,
                                                }}
                                            >
                                                <FormControlLabel
                                                    control={
                                                        <Switch
                                                            checked={entityEnabled}
                                                            onChange={() =>
                                                                onToggleEntity(entity)
                                                            }
                                                            disabled={
                                                                !canManage ||
                                                                persistEnabledEntitiesPending
                                                            }
                                                        />
                                                    }
                                                    label={`Enable ${opt.label.toLowerCase()}`}
                                                />
                                                {isClearBeforeImportEntity(entity) ? (
                                                    <FormControlLabel
                                                        control={
                                                            <Switch
                                                                checked={Boolean(
                                                                    clearBeforeImportSession[
                                                                        entity
                                                                    ]
                                                                )}
                                                                onChange={(e) => {
                                                                    onClearBeforeImportEntityChange(
                                                                        entity,
                                                                        e.target.checked
                                                                    );
                                                                }}
                                                                disabled={
                                                                    !canManage ||
                                                                    !entityEnabled
                                                                }
                                                            />
                                                        }
                                                        label="Delete existing data before import"
                                                        sx={{
                                                            "& .MuiFormControlLabel-label":
                                                                {
                                                                    fontSize:
                                                                        "0.875rem",
                                                                    fontWeight: 500,
                                                                    lineHeight: 1.4,
                                                                },
                                                        }}
                                                    />
                                                ) : null}
                                            </Box>
                                            {entityEnabled ? (
                                                <>
                                            <Tabs
                                                value={entityWorkspaceTab}
                                                onChange={(_, value) =>
                                                    onEntityWorkspaceTabChange(value)
                                                }
                                                sx={{ mb: 2 }}
                                            >
                                                        <Tab
                                                            label="Mapping"
                                                            value="mapping"
                                                        />
                                                        <Tab
                                                            label="Pull Filter"
                                                            value="pullFilter"
                                                        />
                                                        <Tab
                                                            label="Preview Sample Records"
                                                            value="preview"
                                                        />
                                                    </Tabs>
                                                    <Box
                                                        hidden={
                                                            entityWorkspaceTab !==
                                                            "mapping"
                                                        }
                                                    >
                                                        <ConnectorFieldMapper
                                                            ref={(handle) => {
                                                                mapperRefs.current[
                                                                    entity
                                                                ] = handle;
                                                            }}
                                                            accountId={accountId}
                                                            importType={entity}
                                                            canManage={canManage}
                                                            hideEntityHeader
                                                            hideSaveButton
                                                            entitySet={
                                                                config.entity_sets?.[
                                                                    entity
                                                                ] ?? ""
                                                            }
                                                            defaultEntitySet={
                                                                config
                                                                    .default_entity_sets?.[
                                                                    entity
                                                                ] ?? ""
                                                            }
                                                            entitySetCatalog={
                                                                config.entity_set_catalog ??
                                                                []
                                                            }
                                                            onEntitySetChange={
                                                                handleEntitySetChange
                                                            }
                                                            onRefreshEntitySetCatalog={async () => {
                                                                await onRefreshEntitySetCatalog();
                                                            }}
                                                            isRefreshingEntitySetCatalog={
                                                                isRefreshingEntitySetCatalog
                                                            }
                                                            onCompletenessChange={
                                                                handleMappingCompleteness
                                                            }
                                                            onDirtyChange={
                                                                handleEntityConfigDirtyChange
                                                            }
                                                        />
                                                    </Box>
                                                    <Box
                                                        hidden={
                                                            entityWorkspaceTab !==
                                                            "pullFilter"
                                                        }
                                                    >
                                                        <ConnectorEntityPullFilterEditor
                                                            ref={(handle) => {
                                                                pullFilterRefs.current[
                                                                    entity
                                                                ] = handle;
                                                            }}
                                                            accountId={accountId}
                                                            importType={entity}
                                                            canManage={canManage}
                                                            locked={Boolean(
                                                                config.backfill_options_locked
                                                            )}
                                                            config={config}
                                                            hideSaveButton
                                                            onDirtyChange={
                                                                handleEntityConfigDirtyChange
                                                            }
                                                            onSaved={(saved) => {
                                                                onPullFilterSaved(saved);
                                                            }}
                                                        />
                                                    </Box>
                                                    <Box
                                                        hidden={
                                                            entityWorkspaceTab !==
                                                            "preview"
                                                        }
                                                    >
                                                        {entityWorkspaceTab ===
                                                            "preview" &&
                                                        selectedMappingEntityTab ===
                                                            index ? (
                                                            previewEntity ? (
                                                                <ConnectorPreviewSyncResults
                                                                    entity={
                                                                        previewEntity
                                                                    }
                                                                />
                                                            ) : (
                                                                <Alert severity="info">
                                                                    Run preview sync to
                                                                    pull sample rows for{" "}
                                                                    {entity}.
                                                                </Alert>
                                                            )
                                                        ) : null}
                                                    </Box>
                                                </>
                                            ) : null}
                                                </Box>
                                                );
                                            })}
                                </Box>
                                    </CardContent>
                                </AccordionDetails>
                            </Accordion>
                        </Card>
    );
});

export default BillingEntityWorkspace;
