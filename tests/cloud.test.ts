import {it,expect,vi} from 'vitest';
import {CloudAccount,portableSettings} from '../src/services/CloudAccount';
import {DEFAULT_SETTINGS} from '../src/types/settings';
it('syncs only portable preferences and never local paths or update credentials',()=>{
 const data=portableSettings({...DEFAULT_SETTINGS,manualGamePath:'C:/private/game'});
 expect(data).not.toHaveProperty('manualGamePath');expect(data).not.toHaveProperty('updates');expect(data.theme).toBe(DEFAULT_SETTINGS.theme);
});
it('keeps authentication tokens private and rejects syncing after logout',async()=>{
 const request=vi.fn(async()=>({ok:true,json:async()=>({email:'test@example.invalid',localId:'test-id',idToken:'secret-id',refreshToken:'secret-refresh',expiresIn:'3600'})}));
 const service=new CloudAccount(request as unknown as typeof fetch);
 expect(await service.login('test@example.invalid','password')).toEqual({email:'test@example.invalid',uid:'test-id'});
 expect(JSON.stringify(service.status())).not.toContain('secret');service.logout();await expect(service.save(DEFAULT_SETTINGS)).rejects.toThrow('přihlaste');
});
it('rejects invalid emails and short registration passwords before a network call',async()=>{
 const request=vi.fn();const service=new CloudAccount(request as typeof fetch);
 await expect(service.login('bad','secret')).rejects.toThrow('e-mail');await expect(service.login('test@example.invalid','short',true)).rejects.toThrow('8');expect(request).not.toHaveBeenCalled();
});
