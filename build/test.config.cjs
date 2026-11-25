const base=require('../package.json').build;
module.exports={
 ...base,
 appId:'cz.simrailhub.launcher.test',
 productName:'SimRail Hub TEST',
 executableName:'SimRail Hub TEST',
 directories:{...base.directories,output:'.deployment/test-launcher'},
 extraMetadata:{hubChannel:'test',hubBuildId:new Date().toISOString()},
 portable:{artifactName:'SimRail-Hub-TEST.exe'},
 nsis:{...base.nsis,shortcutName:'SimRail Hub TEST',uninstallDisplayName:'SimRail Hub TEST'},
 publish:null
};
