import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";

import { authOptions } from "@/server/auth/authOptions";
import ControlCenterRealtimeService from "@/server/services/ControlCenterRealtimeService";
import { getCorsHeaders } from "@/utils/cors";

export const config = {
    api: {
        bodyParser: false,
    },
};

// Simple WebSocket handler for Control Center updates
const wsHandler = async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method !== "GET") {
        return res.status(405).json({ message: "Method not allowed" });
    }

    try {
        // Get user session
        const session = await getServerSession(req, res, authOptions);

        if (!session?.user?.id) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const userId = session.user.id;

        // Check use_view_as permission
        const { PermissionService } = await import(
            "@/server/services/PermissionService"
        );
        const permissionService = PermissionService.getInstance();
        const effectiveAccountId =
            session.user.view_as_user_account_id || session.user.account_id;
        const effectiveRole =
            session.user.view_as_user_role || session.user.role;
        const hasViewAsPermission =
            (await permissionService.hasPermission(
                effectiveAccountId,
                effectiveRole,
                "use_view_as"
            )) || session.user.account_id === 10013; // Account 10013 always has permission

        // This is a placeholder for WebSocket implementation
        // In a real implementation, you would use a WebSocket library like 'ws'
        // For now, we'll use Server-Sent Events (SSE) as an alternative

        // Get CORS headers with origin validation
        const corsHeaders = getCorsHeaders(req, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "Access-Control-Allow-Headers": "Cache-Control",
        });

        res.writeHead(200, corsHeaders);

        // Add client to real-time service
        const realtimeService = ControlCenterRealtimeService.getInstance();
        const clientId = `${userId}-${Date.now()}`;
        const client = {
            id: clientId,
            readyState: 1, // Simulate WebSocket.OPEN
            send: (message: string) => {
                res.write(`data: ${message}\n\n`);
            },
        };

        realtimeService.addClient(client, userId, hasViewAsPermission);

        // Send initial connection message
        res.write(
            `data: ${JSON.stringify({
                type: "connected",
                message: "Control Center SSE connected",
                userId,
                hasViewAsPermission,
            })}\n\n`
        );

        // Keep connection alive
        const intervalId = setInterval(() => {
            res.write(
                `data: ${JSON.stringify({ type: "ping", timestamp: Date.now() })}\n\n`
            );
        }, 30000); // Send ping every 30 seconds

        // Clean up on disconnect
        req.on("close", () => {
            clearInterval(intervalId);
            realtimeService.removeClient(client);
        });
    } catch (error) {
        console.error("Error in Control Center WebSocket handler:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export default wsHandler;
