// GitHub Releases is the source of truth for downloadable application versions.
(async()=>{
 try{
  const r=await fetch('https://api.github.com/repos/kubiasofficial/simrail-hub/releases/latest',{headers:{Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(5000)});
  if(!r.ok)return;
  const release=await r.json();
  if(typeof release.tag_name!=='string')return;
  const version=release.tag_name.replace(/^v/,'');
  document.getElementById('release-title').textContent='SimRail Hub '+version;
  document.getElementById('version').textContent='Verze '+version+' · Windows 10/11 · zdarma';
  const setup=release.assets?.find(a=>/^SimRail-Hub-Setup-.*\.exe$/.test(a.name));
  if(setup&&/^https:\/\/github\.com\/kubiasofficial\/simrail-hub\/releases\/download\//.test(setup.browser_download_url))document.getElementById('download').href=setup.browser_download_url;
 }catch{/* The bundled release link remains available. */}
})();
