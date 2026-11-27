export interface ShiftRequest {transport:'passenger'|'freight';origin:string;endSod:number;breakMinutes:number;ownedDlc:number[];startDelayMinutes?:number}
export interface ShiftLeg {id:string;number:string;runId:string|null;from:string;to:string;departure:number;arrival:number;takeoverArrival?:number|null;vehicle:string;requiredDlc:number[];availability:'ai'|'player'|'future';sameConsist:boolean}
export interface ShiftPlan {schema:1;server:string;generatedAt:number;serverSod:number;end:number;request:ShiftRequest;legs:ShiftLeg[];notes:string[]}
