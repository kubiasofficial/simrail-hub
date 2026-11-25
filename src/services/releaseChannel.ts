export type ReleaseChannel = 'stable' | 'test';
export function releaseIdentity(packaged:boolean, manifest:unknown) {
 const metadata = manifest && typeof manifest === 'object' ? manifest as Record<string,unknown> : {};
 const channel:ReleaseChannel = !packaged || metadata.hubChannel === 'test' ? 'test' : 'stable';
 return {
  channel,
  name:channel==='test'?'SimRail Hub TEST':'SimRail Hub',
  appId:channel==='test'?'cz.simrailhub.launcher.test':'cz.simrailhub.launcher',
  profileName:channel==='test'?'SimRail Hub TEST':'SimRail Hub',
  buildId:typeof metadata.hubBuildId==='string'?metadata.hubBuildId.slice(0,80):null
 };
}
