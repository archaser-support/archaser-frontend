import { ImportType } from "@prisma/client";

export interface UserImportMapping {
    id: string;
    user_id: string;
    import_type: ImportType;
    mapping: Record<string, string>;
    name?: string;
    is_default: boolean;
    created_at: string;
    modified_at: string;
}

export interface CreateMappingRequest {
    import_type: ImportType;
    mapping: Record<string, string>;
    name: string;
    is_default?: boolean;
}

export interface UpdateMappingRequest {
    mapping?: Record<string, string>;
    name?: string;
    is_default?: boolean;
}

class ImportMappingService {
    private baseUrl = "/api/entities/users/import-mappings";

    async getMappings(importType?: ImportType): Promise<UserImportMapping[]> {
        const url = importType
            ? `${this.baseUrl}?import_type=${importType}`
            : this.baseUrl;

        const response = await fetch(url);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch mappings: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        return data.mappings;
    }

    async getMapping(id: string): Promise<UserImportMapping> {
        const response = await fetch(`${this.baseUrl}/${id}`);

        if (!response.ok) {
            throw new Error(`Failed to fetch mapping: ${response.statusText}`);
        }

        const data = await response.json();
        return data.mapping;
    }

    async createMapping(
        request: CreateMappingRequest
    ): Promise<UserImportMapping> {
        const response = await fetch(this.baseUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(request),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to create mapping: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        return data.mapping;
    }

    async updateMapping(
        id: string,
        request: UpdateMappingRequest
    ): Promise<UserImportMapping> {
        const url = `${this.baseUrl}/${id}`;

        const response = await fetch(url, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(request),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to update mapping: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        return data.mapping;
    }

    async deleteMapping(id: string): Promise<void> {
        const response = await fetch(`${this.baseUrl}/${id}`, {
            method: "DELETE",
        });

        if (!response.ok) {
            throw new Error(`Failed to delete mapping: ${response.statusText}`);
        }
    }

    async getDefaultMapping(
        importType: ImportType
    ): Promise<UserImportMapping | null> {
        const mappings = await this.getMappings(importType);
        return mappings.find((m) => m.is_default) || null;
    }

    async getDefaultMappingForUser(
        importType: ImportType
    ): Promise<UserImportMapping | null> {
        try {
            const mappings = await this.getMappings(importType);
            return mappings.find((m) => m.is_default) || null;
        } catch (_error) {
            return null;
        }
    }

    async saveCurrentMapping(
        importType: ImportType,
        mapping: Record<string, string>,
        name?: string
    ): Promise<UserImportMapping> {
        // Check if a default mapping exists
        const defaultMapping = await this.getDefaultMapping(importType);

        if (defaultMapping) {
            // Update the existing default mapping
            return this.updateMapping(defaultMapping.id, { mapping, name });
        } else {
            // Create a new default mapping - ensure name is never null
            const mappingName = name || `Default ${importType} Mapping`;
            return this.createMapping({
                import_type: importType,
                mapping,
                name: mappingName,
                is_default: true,
            });
        }
    }
}

export const importMappingService = new ImportMappingService();
