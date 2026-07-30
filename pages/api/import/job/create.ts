import { ImportType } from "@prisma/client";
import { NextApiRequest, NextApiResponse } from "next";
import { getSessionOrTestAuth } from "@/utils/testAuthHelper";
import { ImportJobService } from "@/server/services/ImportJobService";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const { import_type, total_records, metadata } = req.body;

        // Get account_id from session for authorization
        const { user } = await getSessionOrTestAuth(req, res);
        const account_id = user?.account_id;
        const user_id = user?.id;

        if (!account_id) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        if (!import_type || !total_records) {
            return res
                .status(400)
                .json({ error: "Import type and total records are required" });
        }

        // Create import job
        const importJob = await ImportJobService.createImportJob(
            {
                account_id,
                user_id,
                import_type: import_type as ImportType,
                total_records: parseInt(total_records, 10),
                metadata: metadata || {},
            },
            user_id
        );

        return res.status(201).json({
            jobId: importJob.id,
            message: "Import job created successfully",
        });
    } catch (err: any) {
        return res.status(500).json({
            error: "Internal server error",
            message: err.message,
        });
    }
}
