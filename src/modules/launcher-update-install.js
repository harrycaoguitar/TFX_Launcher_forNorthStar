"use strict";
const fs=require("node:fs"),fsp=fs.promises,path=require("node:path"),crypto=require("node:crypto");
const {spawn}=require("node:child_process"),{Transform}=require("node:stream"),{pipeline}=require("node:stream/promises");
const {https}=require("follow-redirects");
const maxSize=1024*1024*1024;
const redirectHosts=new Set(["release-assets.githubusercontent.com","objects.githubusercontent.com"]);

async function downloadSetup(setup,destination,{transport=https,progress=()=>{}}={}){
 if(!Number.isSafeInteger(setup.size)||setup.size<=0||setup.size>maxSize||!/^[a-f0-9]{64}$/.test(setup.digest))throw Error("更新包的大小或校验信息无效。");
 const hash=crypto.createHash("sha256");
 let request,response,bytes=0,last=-1;
 const timeout=setTimeout(()=>{
  const error=Error("启动器更新下载超时。");
  request?.destroy(error);response?.destroy(error);
 },10*60*1000);
 timeout.unref();
 try{
  response=await new Promise((resolve,reject)=>{
   request=transport.get(setup.url,{headers:{"User-Agent":"TFX-Launcher","Accept-Encoding":"identity"},maxRedirects:4,beforeRedirect:options=>{
    if(options.protocol!=="https:"||options.port&&String(options.port)!=="443"||options.auth||!redirectHosts.has(options.hostname))throw Error("更新下载重定向不受信任。");
   }},resolve);
   request.on("error",reject);
   request.setTimeout(30000,()=>request.destroy(Error("启动器更新下载超时。")));
  });
  if(response.statusCode!==200)throw Error("更新下载失败：HTTP "+response.statusCode);
  if(response.headers["content-length"]!==undefined&&Number(response.headers["content-length"])!==setup.size)throw Error("更新包大小与 GitHub 不匹配。");
  await pipeline(response,new Transform({transform(chunk,_encoding,done){
   bytes+=chunk.length;
   if(bytes>setup.size){done(Error("更新包大小与 GitHub 不匹配。"));return;}
   hash.update(chunk);
   const percent=Math.floor(100*bytes/setup.size);
   if(percent!==last){last=percent;progress({percent});}
   done(null,chunk);
  }}),fs.createWriteStream(destination,{flags:"wx"}));
  if(bytes!==setup.size||hash.digest("hex")!==setup.digest)throw Error("更新包 SHA-256 校验失败。");
  const header=Buffer.alloc(2),file=await fsp.open(destination,"r");
  try{await file.read(header,0,2,0);}finally{await file.close();}
  if(header.toString()!=="MZ")throw Error("下载的更新包不是 Windows 安装程序。");
 }finally{clearTimeout(timeout);response?.destroy();request?.destroy();}
}

// Pass paths as data; the helper waits for this process to release the files.
// NSIS requires an unquoted /D value as the final argument.
const helper=String.raw`
$ErrorActionPreference='Stop'
$log=Join-Path ([IO.Path]::GetDirectoryName($env:TFX_UPDATE_EXE)) 'log\launcher-update.log'
try {
  if(Get-Process -Id ([int]$env:TFX_UPDATE_PID) -ErrorAction SilentlyContinue) {
    Wait-Process -Id ([int]$env:TFX_UPDATE_PID) -Timeout 90
  }
} catch { Set-Content -LiteralPath $log -Value $_.Exception.Message; exit 1 }
try {
  $hash=[Security.Cryptography.SHA256]::Create()
  try {
    $stream=[IO.File]::OpenRead($env:TFX_UPDATE_SETUP)
    try { $actual=[BitConverter]::ToString($hash.ComputeHash($stream)).Replace('-','') }
    finally { $stream.Dispose() }
  } finally { $hash.Dispose() }
  if($actual -ne $env:TFX_UPDATE_SHA){throw 'TFX installer SHA-256 mismatch'}
  $info=New-Object System.Diagnostics.ProcessStartInfo
  $info.FileName=$env:TFX_UPDATE_SETUP
  $info.Arguments='/S /D='+[IO.Path]::GetDirectoryName($env:TFX_UPDATE_EXE)
  $info.UseShellExecute=$false
  $install=[Diagnostics.Process]::Start($info)
  $install.WaitForExit()
  if($install.ExitCode -ne 0){throw "TFX installer exit code: $($install.ExitCode)"}
  Remove-Item -LiteralPath $env:TFX_UPDATE_SETUP -Force
  Remove-Item -LiteralPath ([IO.Path]::GetDirectoryName($env:TFX_UPDATE_SETUP))
} catch { Set-Content -LiteralPath $log -Value $_.Exception.Message }
Start-Process -FilePath $env:TFX_UPDATE_EXE
`;
async function install({app,setup,progress}){
 if(process.platform!=="win32"||!app.isPackaged||path.basename(process.execPath).toLowerCase()!=="tfx-launcher.exe")throw Error("当前运行方式不支持一键更新。");
 const gate=require("./dds-operation-gate");
 if(require("./launch").isLaunching()||require("./ea-emulator").isActive())throw Error("请退出游戏后再更新启动器。");
 await gate.run("launcher-update",async()=>{
  const directory=await fsp.mkdtemp(path.join(app.getPath("temp"),"tfx-launcher-update-"));
  const installer=path.join(directory,"setup.exe");
  try{
   await downloadSetup(setup,installer,{progress});
   await new Promise((resolve,reject)=>{
    const powerShell=path.join(process.env.SystemRoot||"C:\\Windows","System32","WindowsPowerShell","v1.0","powershell.exe");
    const child=spawn(powerShell,["-NoProfile","-NonInteractive","-EncodedCommand",Buffer.from(helper,"utf16le").toString("base64")],{
     detached:true,windowsHide:true,stdio:"ignore",
     env:{...process.env,TFX_UPDATE_PID:String(process.pid),TFX_UPDATE_EXE:process.execPath,TFX_UPDATE_SETUP:installer,TFX_UPDATE_SHA:setup.digest}
    });
    child.once("error",reject);
    child.once("spawn",()=>{child.unref();resolve();});
   });
  }catch(error){await fsp.rm(directory,{recursive:true,force:true});throw error;}
 });
 setTimeout(()=>app.quit(),200);
}
module.exports={install,downloadSetup,helper};
