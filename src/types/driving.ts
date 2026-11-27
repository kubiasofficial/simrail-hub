export type DriveOriginSource='station'|'near-station'|'section'|'coordinates'|'unavailable';
export interface CommunityConnection {mode:'direct'|'community'|'disabled';verified:boolean;pending:boolean;error:string|null}
export type DeliveryState='queued'|'sending'|'sent'|'failed'|'unknown';
export interface DriveSession {id:string;nickname:string;server:string;number:string;runId:string|null;from:string;to:string;origin:string;originVerified:boolean;originSource?:DriveOriginSource;startedAt:number;shiftId:string|null}
export interface SharedShift {id:string;planKey:string;nickname:string;server:string;transport:'passenger'|'freight';startedAt:number;plannedEnd:number;breakMinutes:number;legs:{id:string;number:string;from:string;to:string}[];completed:string[];breakAt:number|null;readySent:boolean}
export interface DeliverySummary {id:string;kind:string;state:DeliveryState;createdAt:number;attempts:number;messageId?:string;error?:string}
export interface DrivingStatus {connection?:CommunityConnection;revision:number;configured:boolean;nickname:string;drive:DriveSession|null;shift:SharedShift|null;interrupted:boolean;deliveries:DeliverySummary[]}
export interface DriveStartRequest {nickname:string;server:string;number:string;runId:string|null;location?:string}
export interface DriveEndRequest {id:string;location:string;note:string;delayMin:number|null;delayAt:number|null}
export interface SharedShiftRequest {nickname:string;plan:import('./shift').ShiftPlan}
export interface DiscordPayload {allowed_mentions:{parse:string[]};embeds:{title:string;description?:string;color:number;fields:{name:string;value:string;inline?:boolean}[];timestamp:string;footer:{text:string}}[]}
