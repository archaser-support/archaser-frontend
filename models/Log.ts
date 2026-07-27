import mongoose, { Schema, Document, Model } from 'mongoose';

import { LogLevel } from '../types/MongoLog';

// Log document interface
export interface ILog extends Document {
    _id: mongoose.Types.ObjectId;
    timestamp: Date;
    level: LogLevel;
    message: string;
    source: string;
    details?: any;
    account_id?: number;
    user_id?: number;
    job_id?: number;
    correlation_id?: string;
    sub_source?: string;
    created_at: Date;
    modified_at: Date;
}

// Log model interface with static methods
interface ILogModel extends Model<ILog> {
    findByCorrelationId(correlationId: string): Promise<ILog[]>;
    findByCustomer(accountId: number, limit?: number): Promise<ILog[]>;
    findByJob(jobId: number, limit?: number): Promise<ILog[]>;
    findByUser(userId: number, limit?: number): Promise<ILog[]>;
    searchLogs(searchTerm: string, limit?: number): Promise<ILog[]>;
    getLogStats(): Promise<any[]>;
    cleanupOldLogs(retentionDays?: number): Promise<{ deletedCount?: number }>;
}

// Log schema definition
const LogSchema: Schema = new Schema({
    timestamp: {
        type: Date,
        required: true,
        default: Date.now
    },
    level: {
        type: String,
        required: true,
        enum: Object.values(LogLevel),
        index: true
    },
    message: {
        type: String,
        required: true
        // text: true // Disabled to reduce index size
    },
    source: {
        type: String,
        required: true,
        index: true
        // text: true // Disabled to reduce index size
    },
    details: {
        type: Schema.Types.Mixed,
        default: null
    },
    account_id: {
        type: Number,
        index: true,
        sparse: true
    },
    user_id: {
        type: Number,
        index: true,
        sparse: true
    },
    job_id: {
        type: Number,
        index: true,
        sparse: true
    },
    correlation_id: {
        type: String,
        index: true,
        sparse: true
    },
    sub_source: {
        type: String,
        sparse: true
    }
}, {
    timestamps: { created_at: 'created_at', modified_at: 'modified_at' } as any, // snake_case timestamp fields
    collection: 'logs' // Explicit collection name
});

// Compound indexes for common query patterns
LogSchema.index({ account_id: 1, timestamp: -1 });
LogSchema.index({ level: 1, timestamp: -1 });
LogSchema.index({ job_id: 1, timestamp: -1 });
LogSchema.index({ user_id: 1, timestamp: -1 });
LogSchema.index({ correlation_id: 1, timestamp: -1 });
LogSchema.index({ source: 1, timestamp: -1 });

// Text search index for message and source
// Text search index (disabled to reduce storage usage)
// LogSchema.index({
//     message: 'text',
//     source: 'text'
// });

// TTL index for automatic cleanup (7 days - optimized for storage quota)
LogSchema.index({ timestamp: 1 }, {
    expireAfterSeconds: 7 * 24 * 60 * 60 // 604800 seconds (7 days)
});

// Virtual for formatted timestamp
LogSchema.virtual('formattedTimestamp').get(function (this: ILog) {
    return this.timestamp.toISOString();
});

// Instance methods
LogSchema.methods.toLogObject = function (this: ILog) {
    return {
        id: this._id,
        timestamp: this.timestamp,
        level: this.level,
        message: this.message,
        source: this.source,
        details: this.details,
        account_id: this.account_id,
        user_id: this.user_id,
        job_id: this.job_id,
        correlation_id: this.correlation_id,
        sub_source: this.sub_source,
        created_at: this.created_at,
        modified_at: this.modified_at
    };
};

// Static methods
LogSchema.statics.findByCorrelationId = function (correlationId: string) {
    return this.find({ correlation_id: correlationId }).sort({ timestamp: 1 });
};

LogSchema.statics.findByCustomer = function (accountId: number, limit: number = 100) {
    return this.find({ account_id: accountId })
        .sort({ timestamp: -1 })
        .limit(limit);
};

LogSchema.statics.findByJob = function (jobId: number, limit: number = 100) {
    return this.find({ job_id: jobId })
        .sort({ timestamp: -1 })
        .limit(limit);
};

LogSchema.statics.findByUser = function (userId: number, limit: number = 100) {
    return this.find({ user_id: userId })
        .sort({ timestamp: -1 })
        .limit(limit);
};

LogSchema.statics.searchLogs = function (searchTerm: string, limit: number = 100) {
    return this.find({
        $text: { $search: searchTerm }
    }).sort({ timestamp: -1 }).limit(limit);
};

LogSchema.statics.getLogStats = function () {
    return this.aggregate([
        {
            $group: {
                _id: null,
                totalLogs: { $sum: 1 },
                logsByLevel: {
                    $push: {
                        level: '$level',
                        count: 1
                    }
                },
                logsBySource: {
                    $push: {
                        source: '$source',
                        count: 1
                    }
                }
            }
        }
    ]);
};

LogSchema.statics.cleanupOldLogs = function (retentionDays: number = 5) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    return this.deleteMany({
        timestamp: { $lt: cutoffDate }
    });
};

// Pre-save middleware
LogSchema.pre<ILog>('save', function (this: ILog, next: () => void) {
    // Ensure timestamp is set if not provided
    if (!this.timestamp) {
        this.timestamp = new Date();
    }
    next();
});

// Note: Pre-delete middleware can be added here if needed

// Create and export the model
const Log: ILogModel = mongoose.models.Log as ILogModel || mongoose.model<ILog, ILogModel>('Log', LogSchema);

export default Log;
