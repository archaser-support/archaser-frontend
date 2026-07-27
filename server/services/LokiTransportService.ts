import axios from "axios";
import { CreateLogData, LogLevel } from "../../types/MongoLog";

/**
 * Service for sending logs to Grafana Loki
 * Implements a "fire-and-forget" approach to not block the main application
 */
export class LokiTransportService {
    private lokiUrl: string;
    private enabled: boolean;
    private serviceName: string;
    private environment: string;

    constructor() {
        this.lokiUrl = process.env.LOKI_HOST || "http://localhost:3100";
        this.enabled = process.env.ENABLE_LOKI_LOGGING === "true";
        this.serviceName = process.env.SERVICE_NAME || "archaser-core";
        this.environment = process.env.NODE_ENV || "development";
    }

    /**
     * Send defined log entry to Loki
     */
    async sendLog(logData: CreateLogData): Promise<void> {
        if (!this.enabled) return;

        // Don't await this, let it run in background
        this.pushToLoki(logData).catch((err) => {
            // Silently fail or log to console in dev?
            // We don't want to cause infinite loops if logging fails
            // Silently fail in development to prevent terminal spam
            // if Loki server is not running locally.
        });
    }

    /**
     * Public method to push log to Loki and await the result
     * Useful for migration scripts or critical logs where confirmation is needed
     */
    async pushLog(logData: CreateLogData): Promise<void> {
        if (!this.enabled) return;
        return this.pushToLoki(logData);
    }

    /**
     * Internal method to push data to Loki API
     * Loki API expects:
     * {
     *   "streams": [
     *     {
     *       "stream": { "label": "value" },
     *       "values": [ [ "unix_epoch_ns", "log_line" ] ]
     *     }
     *   ]
     * }
     */
    private async pushToLoki(logData: CreateLogData): Promise<void> {
        const timestampNs =
            (logData.timestamp || new Date()).getTime() * 1000000;

        // Prepare the payload
        const payload = {
            streams: [
                {
                    stream: {
                        service: this.serviceName,
                        environment: this.environment,
                        level: logData.level,
                        source: logData.source,
                        customer_id: logData.account_id
                            ? String(logData.account_id)
                            : "system",
                    },
                    values: [
                        [
                            String(timestampNs),
                            JSON.stringify({
                                message: logData.message,
                                details: logData.details,
                                correlation_id: logData.correlation_id,
                                user_id: logData.user_id,
                                job_id: logData.job_id,
                                sub_source: logData.sub_source,
                            }),
                        ],
                    ],
                },
            ],
        };

        try {
            await axios.post(`${this.lokiUrl}/loki/api/v1/push`, payload, {
                headers: {
                    "Content-Type": "application/json",
                },
                timeout: 1000, // Short timeout to prevent holding resources
            });
        } catch (error) {
            // Rethrow and let the caller (fire-and-forget wrapper) handle logging
            throw error;
        }
    }
}

// Export singleton
export const lokiTransportService = new LokiTransportService();
export default lokiTransportService;
