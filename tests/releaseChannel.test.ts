import {it,expect} from 'vitest';
import {createRequire} from 'node:module';
import {releaseIdentity} from '../src/services/releaseChannel';
const require=createRequire(import.meta.url);

it('keeps existing public packages on the stable identity and profile',()=>{
 expect(releaseIdentity(true,{version:'0.5.0'})).toMatchObject({channel:'stable',name:'SimRail Hub',appId:'cz.simrailhub.launcher',profileName:'SimRail Hub'});
});
it('separates development and explicitly stamped test builds from stable data',()=>{
 const stable=releaseIdentity(true,{}),test=releaseIdentity(true,{hubChannel:'test'});
 expect(test.channel).toBe('test');expect(test.appId).not.toBe(stable.appId);expect(test.profileName).not.toBe(stable.profileName);expect(test.name).toContain('TEST');
 expect(releaseIdentity(false,{}).channel).toBe('test');
});
it('test packaging never publishes or changes public artifact identity',()=>{
 const config=require('../build/test.config.cjs'),base=require('../package.json').build;
 expect(config.publish).toBeNull();expect(config.extraMetadata.hubChannel).toBe('test');
 expect(config.appId).not.toBe(base.appId);expect(config.executableName).toBe('SimRail Hub TEST');
 expect(config.directories.output).toBe('.deployment/test-launcher');
 expect(config.portable.artifactName).toBe('SimRail-Hub-TEST.exe');
 expect(base.productName).toBe('SimRail Hub');expect(base.appId).toBe('cz.simrailhub.launcher');
});
