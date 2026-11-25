const fs=require('fs'),path=require('path'),{pathToFileURL}=require('url');
(async()=>{
 const root=process.cwd(),qa=path.join(root,'verification-output/beta2-demo-20261124'),manifest=JSON.parse(fs.readFileSync(path.join(qa,'source-manifest.json')));
 const asar=await import(pathToFileURL(path.join(root,'build-tools/asar/node_modules/@electron/asar/lib/asar.js')).href);
 for(const {file}of manifest.files){const out=path.join(qa,'reference',file);fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,asar.extractFile(manifest.archive,path.normalize(file)));}
 const demo=fs.readFileSync('TFX-Launcher-2.0.0-beta2-Demo.html','utf8');
 const injection=demo.slice(demo.indexOf('<head>')+6,demo.indexOf('<meta charset='));
 const ref=path.join(qa,'reference/src/app/prototype/index.html');fs.writeFileSync(ref,fs.readFileSync(ref,'utf8').replace('<head>','<head>'+injection));
 console.log('Reference extracted from shipped beta2 ASAR; production UI scripts preserved byte-for-byte.');
})().catch(e=>{console.error(e);process.exitCode=1});
