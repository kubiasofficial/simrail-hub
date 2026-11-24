export type DelaySeverity='unknown'|'early'|'ontime'|'small'|'late'|'critical';
export function delaySeverity(minutes:number|null):DelaySeverity {
 if(minutes===null)return 'unknown';if(minutes<0)return 'early';if(minutes===0)return 'ontime';if(minutes<=5)return 'small';if(minutes<=20)return 'late';return 'critical';
}
