export const releaseSeenKey=(version:string)=>'simrail:release-seen:stable:'+version;
export function isNewerRelease(candidate:string,current:string):boolean {
 if(!/^\d+\.\d+\.\d+$/.test(candidate)||!/^\d+\.\d+\.\d+$/.test(current))return false;
 const a=candidate.split('.').map(Number),b=current.split('.').map(Number);
 for(let i=0;i<3;i++)if(a[i]!==b[i])return a[i]>b[i];return false;
}
export function canShowInstalledRelease(channel:string,installed:string,announced:string,seen:boolean):boolean {return channel==='stable'&&installed===announced&&!seen;}
