import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";

import { authOptions } from "@/server/auth/authOptions";
import NotificationRealtimeService from "@/server/services/NotificationRealtimeService";
import { getCorsHeaders, isOriginAllowed } from "@/utils/cors";

// Disable body parsing for SSE endpoint
export const config = {
    api: {
        bodyParser: false,
    },
};

export default async function handler(
    request: NextApiRequest,
    res: NextApiResponse
) {
    if (request.method !== "GET") {
        return res.status(405).json({ message: "Method not allowed" });
    }

    try {
        // Get user session
        const session = await getServerSession(request, res, authOptions);

        if (!session?.user?.id) {
            // For EventSource, we need to send an error message in SSE format
            // before closing the connection, otherwise EventSource will show empty error
            res.writeHead(401, {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "close",
            });
            res.write(
                `data: ${JSON.stringify({
                    type: "error",
                    message: "Unauthorized - Session invalid or expired",
                    timestamp: new Date().toISOString(),
                })}\n\n`
            );
            res.end();
            return;
        }

        const userId = session.user.id;
        const accountId = session.user.account_id || 10013;

        // Get CORS headers with origin validation
        const corsHeaders = getCorsHeaders(request, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "Access-Control-Allow-Headers": "Cache-Control",
        });

        // Set headers for Server-Sent Events
        res.writeHead(200, corsHeaders);

        // Add client to real-time service
        const realtimeService = NotificationRealtimeService.getInstance();
        const clientId = `${userId}-${Date.now()}`;

        // Helper function to safely write to response with error handling
        const safeWrite = (data: string): boolean => {
            try {
                if (res.writable && !res.destroyed) {
                    res.write(data);
                    // Flush the response to ensure data is sent immediately
                    if (typeof (res as any).flush === "function") {
                        (res as any).flush();
                    }
                    return true;
                }
                return false;
            } catch (error) {
                console.error(
                    "[Notification SSE] Error writing to response:",
                    error
                );
                return false;
            }
        };

        const client = {
            id: clientId,
            userId,
            accountId,
            readyState: 1, // Simulate WebSocket.OPEN
            send: (message: string) => {
                safeWrite(`data: ${message}\n\n`);
            },
        };

        await realtimeService.addClient(client, userId, accountId);

        // Send initial connection message
        safeWrite(
            `data: ${JSON.stringify({
                type: "connected",
                message: "Notification SSE connected",
                userId,
                accountId,
            })}\n\n`
        );

        // Keep connection alive with periodic heartbeats
        const heartbeatInterval = setInterval(() => {
            if (
                !safeWrite(
                    `data: ${JSON.stringify({
                        type: "heartbeat",
                        timestamp: Date.now(),
                    })}\n\n`
                )
            ) {
                // If write fails, connection is likely closed
                clearInterval(heartbeatInterval);
                realtimeService.removeClient(clientId);
            }
        }, 30000); // Send heartbeat every 30 seconds

        // Handle client disconnect
        const cleanup = () => {
            clearInterval(heartbeatInterval);
            realtimeService.removeClient(clientId);
            if (!res.destroyed && res.writable) {
                try {
                    res.end();
                } catch (error) {
                    // Ignore errors when ending already closed connection
                }
            }
        };

        // Clean up on disconnect
        request.on("close", cleanup);
        request.on("aborted", cleanup);

        // Keep the connection open
        request.on("end", cleanup);

        // Handle response errors
        res.on("error", (error) => {
            console.error("[Notification SSE] Response error:", error);
            cleanup();
        });

        // Prevent the handler from completing (keep connection open)
        // The connection will be closed when the client disconnects
        await new Promise<void>((resolve) => {
            request.on("close", () => {
                resolve();
            });
            request.on("end", () => {
                resolve();
            });
        });
    } catch (error) {
        console.error(
            "[Notification SSE] Error in notification WebSocket:",
            error
        );

        // Only send error if headers haven't been sent yet
        if (!res.headersSent) {
            res.writeHead(500, {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "close",
            });
        }

        try {
            res.write(
                `data: ${JSON.stringify({
                    type: "error",
                    message:
                        error instanceof Error
                            ? error.message
                            : "Server error occurred",
                    timestamp: new Date().toISOString(),
                })}\n\n`
            );
        } catch (writeError) {
            // Ignore write errors if connection is already closed
            console.error(
                "[Notification SSE] Error writing error message:",
                writeError
            );
        }

        res.end();
    }
}
