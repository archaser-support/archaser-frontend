import fs from "fs";
import path from "path";

export interface PrismaRelation {
    from: string;
    to: string;
    fromField: string;
    toField: string;
    type: "one-to-one" | "one-to-many" | "many-to-many";
}

export class PrismaSchemaService {
    private static instance: PrismaSchemaService;
    private schemaPath: string;
    private cachedRelations: PrismaRelation[] | null = null;

    private constructor() {
        this.schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");
    }

    public static getInstance(): PrismaSchemaService {
        if (!PrismaSchemaService.instance) {
            PrismaSchemaService.instance = new PrismaSchemaService();
        }
        return PrismaSchemaService.instance;
    }

    /**
     * Parse Prisma schema to extract relationships
     */
    public getRelationships(): PrismaRelation[] {
        if (this.cachedRelations) {
            return this.cachedRelations;
        }

        try {
            const schemaContent = fs.readFileSync(this.schemaPath, "utf-8");
            const relations: PrismaRelation[] = [];

            // Extract model definitions
            const modelRegex = /model\s+(\w+)\s*\{([\s\S]*?)\}/g;
            const models: Map<string, string> = new Map();

            let match;
            while ((match = modelRegex.exec(schemaContent)) !== null) {
                const modelName = match[1];
                const modelBody = match[2];
                models.set(modelName, modelBody);
            }

            // Parse relations from each model
            models.forEach((modelBody, modelName) => {
                // Find relation fields (fields that reference other models)
                const relationFieldRegex =
                    /(\w+)\s+(\w+)\??\s+@relation\([^)]*\)/g;
                const relationFields: Array<{
                    fieldName: string;
                    fieldType: string;
                    relationDef: string;
                }> = [];

                let fieldMatch;
                while (
                    (fieldMatch = relationFieldRegex.exec(modelBody)) !== null
                ) {
                    const fieldName = fieldMatch[1];
                    const fieldType = fieldMatch[2];
                    const fullMatch = fieldMatch[0];

                    // Extract relation definition
                    const relationDefMatch =
                        fullMatch.match(/@relation\(([^)]+)\)/);
                    if (relationDefMatch) {
                        relationFields.push({
                            fieldName,
                            fieldType,
                            relationDef: relationDefMatch[1],
                        });
                    }
                }

                // Also find fields that reference other models without explicit @relation
                const foreignKeyRegex = /(\w+)\s+(\w+)\??\s+@db\.\w+/g;
                let fkMatch;
                while ((fkMatch = foreignKeyRegex.exec(modelBody)) !== null) {
                    const fieldName = fkMatch[1];
                    const fieldType = fkMatch[2];

                    // Check if this field type is a model (starts with capital letter and exists in models)
                    if (
                        /^[A-Z]/.test(fieldType) &&
                        models.has(fieldType) &&
                        fieldType !== modelName
                    ) {
                        // This is likely a foreign key
                        const targetModelBody = models.get(fieldType) || "";
                        // Check if target model has a back-reference
                        const backRefRegex = new RegExp(
                            `\\w+\\s+${modelName}\\[?\\]?\\s+@relation`
                        );
                        if (backRefRegex.test(targetModelBody)) {
                            // It's a relation, but we need to find the back-reference field
                            const backRefMatch = targetModelBody.match(
                                new RegExp(
                                    `(\\w+)\\s+${modelName}\\[?\\]?\\s+@relation\\(([^)]+)\\)`
                                )
                            );
                            if (backRefMatch) {
                                relations.push({
                                    from: modelName,
                                    to: fieldType,
                                    fromField: fieldName,
                                    toField: backRefMatch[1],
                                    type: "one-to-many",
                                });
                            }
                        }
                    }
                }

                // Process explicit relations
                relationFields.forEach(
                    ({ fieldName, fieldType, relationDef }) => {
                        // Extract fields from relation definition
                        const fieldsMatch = relationDef.match(
                            /fields:\s*\[([^\]]+)\]/
                        );
                        const referencesMatch = relationDef.match(
                            /references:\s*\[([^\]]+)\]/
                        );

                        if (fieldsMatch && referencesMatch) {
                            const fromField = fieldsMatch[1].trim();
                            const toField = referencesMatch[1].trim();
                            const targetModel = fieldType
                                .replace("[]", "")
                                .replace("?", "");

                            // Determine relation type based on field type
                            let relationType:
                                | "one-to-one"
                                | "one-to-many"
                                | "many-to-many" = "one-to-many";
                            if (fieldType.includes("[]")) {
                                relationType = "many-to-many";
                            } else if (!fieldType.includes("?")) {
                                // Check if it's one-to-one by looking at the target model
                                const targetModelBody =
                                    models.get(targetModel) || "";
                                const targetHasArray = targetModelBody.includes(
                                    `${modelName}[]`
                                );
                                if (!targetHasArray) {
                                    relationType = "one-to-one";
                                }
                            }

                            // Add the forward relationship
                            relations.push({
                                from: modelName,
                                to: targetModel,
                                fromField,
                                toField,
                                type: relationType,
                            });

                            // Find and add the reverse relationship if it exists
                            const targetModelBody =
                                models.get(targetModel) || "";
                            // Look for back-reference: fieldName ModelName[] or fieldName ModelName? in target model
                            // Pattern matches: "  Contact                         Contact[]" or "  Customer Customer?"
                            const backRefRegex = new RegExp(
                                `(\\w+)\\s+${modelName}(\\[\\])?\\??`
                            );
                            const backRefMatch =
                                targetModelBody.match(backRefRegex);

                            if (backRefMatch) {
                                const backRefFieldName = backRefMatch[1];
                                const isArray = backRefMatch[2] === "[]";

                                // Determine reverse relation type
                                let reverseType:
                                    | "one-to-one"
                                    | "one-to-many"
                                    | "many-to-many" = isArray
                                    ? "one-to-many"
                                    : "one-to-one";

                                // Add reverse relationship (from target model to source model)
                                // Check if this reverse relationship already exists to avoid duplicates
                                const reverseExists = relations.some(
                                    (r) =>
                                        r.from === targetModel &&
                                        r.to === modelName
                                );

                                if (!reverseExists) {
                                    relations.push({
                                        from: targetModel,
                                        to: modelName,
                                        fromField: toField, // The target model's primary key (e.g., Customer.id)
                                        toField: fromField, // The foreign key in the source model (e.g., Contact.customer_id)
                                        type: reverseType,
                                    });
                                }
                            }
                        }
                    }
                );
            });

            this.cachedRelations = relations;

            return relations;
        } catch (error) {
            return [];
        }
    }

    /**
     * Find relationship between two models
     */
    public findRelationship(
        fromModel: string,
        toModel: string
    ): PrismaRelation | null {
        const relations = this.getRelationships();
        return (
            relations.find((r) => r.from === fromModel && r.to === toModel) ||
            relations.find((r) => r.from === toModel && r.to === fromModel) ||
            null
        );
    }

    /**
     * Get all relationships for a model
     */
    public getModelRelationships(modelName: string): PrismaRelation[] {
        const relations = this.getRelationships();
        return relations.filter(
            (r) => r.from === modelName || r.to === modelName
        );
    }
}
