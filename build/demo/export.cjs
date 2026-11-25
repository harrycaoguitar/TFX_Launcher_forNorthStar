const fs=require('fs'),path=require('path'),{pathToFileURL}=require('url'),crypto=require('crypto');
(async()=>{
 const root=path.resolve(__dirname,'../..'),out=path.join(root,'TFX-Launcher-2.0.0-beta2-Demo.html');
 const archive=path.join(root,'dist-beta2-final-20261124/TFX-Launcher-2.0.0-beta2/resources/app.asar');
 const asar=await import(pathToFileURL(path.join(root,'build-tools/asar/node_modules/@electron/asar/lib/asar.js')).href);
 const manifest=[];const read=name=>{const bytes=asar.extractFile(archive,path.normalize(name));manifest.push({file:name,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});return bytes;};
 const version=JSON.parse(read('package.json')).version;if(version!=='2.0.0-beta2')throw Error('Unexpected packaged version '+version);
 const mime={'.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.woff':'font/woff'};
 const assets=new Map();const asset=name=>{if(!assets.has(name))assets.set(name,'data:'+(mime[path.extname(name)]||'application/octet-stream')+';base64,'+read(name).toString('base64'));return assets.get(name);};
 function inlineAssets(text,base){return text.replace(/(["'(])((?:\.\.\/|\.\/)[^"')\s]+\.(?:svg|png|jpg|woff2?|jpeg))(?=["')])/g,(_m,start,url)=>start+asset(path.posix.normalize(path.posix.join(base,url))));}
 const js=text=>'<script>'+text.replace(/<\/script/gi,'<\\/script')+'</script>';
 let html=read('src/app/prototype/index.html').toString('utf8');
 html=html.replace(/<link rel="stylesheet" href="([^"]+)">/g,(_m,url)=>{const file=path.posix.join('src/app/prototype',url);return '<style data-source="'+file+'">'+inlineAssets(read(file).toString('utf8'),path.posix.dirname(file))+'</style>';});
 html=html.replace(/<script src="([^"]+)"><\/script>/g,(_m,url)=>{const file=path.posix.normalize(path.posix.join('src/app/prototype',url));return js(inlineAssets(read(file).toString('utf8'),path.posix.dirname(file)));});
 html=inlineAssets(html,'src/app/prototype');
 const locales={zh:JSON.parse(read('src/lang/zh.json')),en:JSON.parse(read('src/lang/en.json'))};
 for(const tag of ['zh-TW','de-DE','fr-FR'])locales[tag]=JSON.parse(read('src/lang/ui-'+tag+'.json')).strings;
 const bridge=fs.readFileSync(path.join(__dirname,'bridge.js'),'utf8');
 html=html.replace('<head>','<head>\n<!-- TFX 2.0.0-beta2 offline presentation; all accounts, paths and servers are fictional. -->\n'+js('window.TFXDemoLocales='+JSON.stringify(locales)+';')+js(bridge));
 // Full self-contained document: leave production presentation code unchanged.
 fs.writeFileSync(out,html);fs.writeFileSync(path.join(root,'verification-output/beta2-demo-20261124/source-manifest.json'),JSON.stringify({archive,version,files:manifest,output:out,bytes:Buffer.byteLength(html)},null,2));console.log(JSON.stringify({out,bytes:Buffer.byteLength(html),sources:manifest.length}));
})().catch(e=>{console.error(e);process.exitCode=1;});
