import { Activity } from "./Activity";
import { ActivityType } from "./enums";

export interface ActivityStatus {
    id: number;
    created_at: Date;
    name: string;
    modifiedAt: Date;
    type: ActivityType;
    description?: string;
    activities: Activity[];
}
