"use strict";
const fs = require("fs"), fsp = fs.promises, path = require("path"), crypto = require("crypto");
const {execFile} = require("child_process");
const https = require("follow-redirects").https;
const {validateManifest, validateBundle, ownedPath, CORE_DIRS} = require("./northstar-client");
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const MAX_ZIP = 256 * 1024 * 1024, MAX_PAYLOAD = 512 * 1024 * 1024;
function trustedRedirect(options,region) {
  const hosts=region==="global"?["github.com","release-assets.githubusercontent.com","objects.githubusercontent.com"]:["github.com","release-assets.githubusercontent.com","objects.githubusercontent.com","gitee.com","foruda.gitee.com"];
  if(options.protocol!=="https:"||!hosts.includes(String(options.hostname||"").toLowerCase())||options.auth||options.port&&String(options.port)!=="443")throw Error("北极星更新地址与所选频道不匹配");
}
function cleanPath(name) {
  // 7-Zip escapes Windows-illegal ZIP filename characters into U+F0xx.
  // Reject that display range too, instead of overlooking an unsafe entry.
  if (typeof name !== "string" || name.includes("\\") || name.length > 1024 || name.startsWith("/") || name.split("/").some(part => !part || part === "." || part === ".." || /[<>:"|?*\x00-\x1f\uf000-\uf0ff]/.test(part) || /[. ]$/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) throw Error("北极星压缩包包含不安全的文件路径");
  return name;
}
function listing(output) {
  const body = output.split(/^-{10,}\r?$/m)[1];
  if (!body) throw Error("北极星压缩包目录无法读取");
  const rows = body.trim().split(/\r?\n\s*\r?\n/).map(block => Object.fromEntries(block.split(/\r?\n/).filter(line => line.includes(" = ")).map(line => {const i = line.indexOf(" = "); return [line.slice(0,i),line.slice(i+3)];})));
  if (!rows.length || rows.length > 12000) throw Error("北极星压缩包文件数量无效");
  const seen = new Set();
  for (const row of rows) {
    // Windows 7-Zip renders ZIP path separators as backslashes even when the
    // archive stores forward slashes. Validate after normalizing that display.
    row.path = cleanPath(typeof row.Path === "string" ? row.Path.replace(/\\/g,"/") : row.Path); const key = row.path.toLowerCase();
    if (seen.has(key) || row.Encrypted === "+" || /(?:^|\s)(?:l[rwx-]{9}|L)(?:\s|$)/.test(row.Attributes || "") || row["Symbolic Link"] || row["Hard Link"]) throw Error("北极星压缩包包含重复、加密或链接文件");
    seen.add(key); row.directory = row.Folder === "+" || /^D/.test(row.Attributes || "");
    row.size = Number(row.Size || 0);
    if (!Number.isSafeInteger(row.size) || row.size < 0) throw Error("北极星压缩包声明的文件体积无效");
  }
  return rows;
}
async function hashFile(filename) {
  const h = crypto.createHash("sha256"); for await (const b of fs.createReadStream(filename)) h.update(b); return h.digest("hex");
}
async function writeJson(filename, value) {
  const temporary = filename + ".tmp-" + crypto.randomUUID();
  try {await fsp.writeFile(temporary, JSON.stringify(value,null,2),{flag:"wx"}); await fsp.rename(temporary,filename);}
  finally {await fsp.rm(temporary,{force:true});}
}
class ClientBundleCache {
  constructor({sourceRoot, cacheRoot, toolsDir, validateURL, releaseProvider, progress = () => {}, transport=https}) {
    this.sourceRoot = sourceRoot; this.cacheRoot = cacheRoot; this.toolsDir = toolsDir; this.validateURL = validateURL; this.releaseProvider=releaseProvider; this.progress = progress; this.transport=transport; this.pending = new Map();
  }
  async safeCachePath(filename, includeLeaf = true) {
    const base = path.resolve(this.cacheRoot), target = path.resolve(filename), relative = path.relative(base,target);
    if (relative === ".." || relative.startsWith(".."+path.sep) || path.isAbsolute(relative)) throw Error("北极星缓存路径越界");
    const parts = target.slice(path.parse(target).root.length).split(path.sep).filter(Boolean);
    let current = path.parse(target).root;
    for (let index = 0; index < parts.length - (includeLeaf ? 0 : 1); index++) {
      current = path.join(current,parts[index]); let stat;
      try {stat = await fsp.lstat(current);} catch(error) {if(error.code==="ENOENT")continue;throw error;}
      if (stat.isSymbolicLink() || index < parts.length-1 && !stat.isDirectory()) throw Error("北极星缓存目录包含链接或同名文件");
    }
    return target;
  }
  tool(args) {return new Promise((resolve,reject) => execFile(path.join(this.toolsDir,"7z.exe"), args, {encoding:"utf8",windowsHide:true,timeout:180000,maxBuffer:12*1024*1024}, (error,stdout,stderr) => error ? reject(Error("北极星压缩包读取失败：" + (stderr?.trim() || error.message))) : resolve(stdout)));}
  async extract(archive, destination, paths) {
    // 7-Zip reads exact names from a UTF-8 list, avoiding Windows command-line
    // limits and excluding debug/server files without decompressing them.
    const include = destination + "-files.txt"; await fsp.writeFile(include, paths.join("\n") + "\n", "utf8");
    try {await this.tool(["x","-y","-bd","-bso0","-bsp0","-scsUTF-8",archive,"@"+include,"-o"+destination]);}
    finally {await fsp.rm(include,{force:true});}
  }
  async base(channel) {
    if (this.pending.has(channel)) return this.pending.get(channel);
    const promise = this.prepareBase(channel).finally(() => this.pending.delete(channel)); this.pending.set(channel,promise); return promise;
  }
  async prepareBase(channel) {
    const source = path.join(this.sourceRoot,channel), manifest = validateManifest(JSON.parse(await fsp.readFile(path.join(source,"manifest.json"),"utf8")),channel);
    const archive = manifest.archive;
    if (!archive || archive.path !== "payload.zip" || archive.format !== "zip" || !Number.isSafeInteger(archive.size) || archive.size < 0 || archive.size > MAX_ZIP || !/^[a-f0-9]{64}$/.test(archive.sha256)) throw Error("内置北极星客户端压缩包清单无效");
    const key = sha(Buffer.from(JSON.stringify(manifest))), directory = path.join(this.cacheRoot,"bundled",channel+"-"+key);
    await this.safeCachePath(directory);
    if (fs.existsSync(directory)) {if((await validateBundle(directory,channel)).digest!==key)throw Error("北极星内置缓存清单与来源不一致");return directory;}
    await fsp.mkdir(path.dirname(directory),{recursive:true});
    const stage = await fsp.mkdtemp(path.join(path.dirname(directory),"prepare-"));
    try {
      const zipped = path.join(source,"payload.zip"), stat = await fsp.lstat(zipped);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== archive.size || await hashFile(zipped) !== archive.sha256) throw Error("内置北极星客户端压缩包校验失败");
      const rows = listing(await this.tool(["l","-slt","-sccUTF-8",zipped])), expected = new Map(manifest.files.map(file => [file.path,file]));
      for (const row of rows.filter(row => !row.directory)) if (!expected.has(row.path) || expected.get(row.path).size !== row.size) throw Error("内置北极星客户端压缩包与清单不一致");
      if (rows.filter(row => !row.directory).length !== expected.size) throw Error("内置北极星客户端压缩包缺少文件");
      await fsp.mkdir(path.join(stage,"payload")); await this.extract(zipped,path.join(stage,"payload"),[...expected.keys()]);
      await writeJson(path.join(stage,"manifest.json"),manifest); await validateBundle(stage,channel);
      await fsp.rename(stage,directory); return directory;
    } finally {await fsp.rm(stage,{recursive:true,force:true});}
  }
  async provided(channel) {
    const descriptor = await this.descriptor(channel);
    if ((await validateBundle(descriptor.directory,channel)).digest !== descriptor.expectedDigest) throw Error("北极星更新缓存清单与索引不一致");
    return descriptor.directory;
  }
  async descriptor(channel) {
    if (!["cn","global"].includes(channel)) throw Error("北极星更新频道无效");
    const pointer = path.join(this.cacheRoot,"updates",channel+".json");
    await this.safeCachePath(pointer);
    if (!fs.existsSync(pointer)) {
      return this.defaultDescriptor(channel);
    }
    const stat = await fsp.lstat(pointer);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4096) throw Error("北极星更新缓存索引无效");
    const value = JSON.parse(await fsp.readFile(pointer,"utf8"));
    if (value.channel !== channel || !/^[a-f0-9]{64}$/.test(value.directory)) throw Error("北极星更新缓存索引无效");
    const directory = path.join(this.cacheRoot,"updates",value.directory);
    await this.safeCachePath(directory);
    const filename=path.join(directory,"manifest.json"), manifestStat=await fsp.lstat(filename);
    if (!manifestStat.isFile() || manifestStat.isSymbolicLink() || manifestStat.size > 8*1024*1024) throw Error("北极星更新缓存清单与索引不一致");
    const manifest=validateManifest(JSON.parse(await fsp.readFile(filename,"utf8")),channel);
    if (sha(Buffer.from(JSON.stringify(manifest)))!==value.directory) throw Error("北极星更新缓存清单与索引不一致");
    if (channel === "cn") {
      const baseline = validateManifest(JSON.parse(await fsp.readFile(path.join(this.sourceRoot,channel,"manifest.json"),"utf8")),channel);
      // A shared download cache is not an installed client. Keep first CN
      // deployment on the shipped GitHub release; installed snapshots are
      // still preferred by the transaction engine and explicit updates bypass this.
      if (manifest.version.replace(/^v/,"") !== baseline.version.replace(/^v/,"")) return this.defaultDescriptor(channel);
    }
    return {directory,expectedDigest:value.directory,preferSnapshot:true};
  }
  async defaultDescriptor(channel) {
    const manifest = validateManifest(JSON.parse(await fsp.readFile(path.join(this.sourceRoot,channel,"manifest.json"),"utf8")),channel);
    const expectedDigest = sha(Buffer.from(JSON.stringify(manifest))), directory = path.join(this.cacheRoot,"bundled",channel+"-"+expectedDigest);
    await this.safeCachePath(directory);
    // A warm descriptor reads metadata only. The transaction engine validates
    // the payload once in the same operation before using its bytes.
    if (!fs.existsSync(directory)) {
      if (fs.existsSync(path.join(this.sourceRoot,channel,"payload.zip"))) await this.base(channel);
      else {
        if (!this.releaseProvider) throw Error("北极星客户端资源未随启动器内置，且没有可用的云端下载源");
        const release = await this.releaseProvider(channel);
        if (!release) throw Error("未能获取所选频道的北极星客户端正式版本");
        if (channel === "cn" && release.version?.replace(/^v/,"") !== manifest.version.replace(/^v/,"")) throw Error("国服北极星默认下载版本与 GitHub 分发清单不一致");
        await this.update(release);
        return this.descriptor(channel);
      }
    }
    else {
      const filename=path.join(directory,"manifest.json"), stat=await fsp.lstat(filename);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 8*1024*1024) throw Error("北极星内置缓存清单与来源不一致");
      const cached=validateManifest(JSON.parse(await fsp.readFile(filename,"utf8")),channel);
      if (sha(Buffer.from(JSON.stringify(cached)))!==expectedDigest) throw Error("北极星内置缓存清单与来源不一致");
    }
    return {directory,expectedDigest,preferSnapshot:true};
  }
  async download(release, target) {
    if (!this.validateURL(release.download_link,release.version,undefined,release.region)) throw Error("北极星更新地址与所选频道不匹配");
    let request,response,ownsFile=false,bytes=0;
    const timer=setTimeout(()=>{const error=Error("北极星客户端下载超时");request?.destroy(error);response?.destroy(error);},120000);timer.unref?.();
    try {
      response=await new Promise((resolve,reject)=>{
        try{
          request=this.transport.get(release.download_link,{headers:{"User-Agent":"TFX-Launcher","Accept-Encoding":"identity"},maxRedirects:5,beforeRedirect:options=>trustedRedirect(options,release.region)},resolve);
          request.on("error",reject);request.setTimeout(30000,()=>request.destroy(Error("北极星客户端下载超时")));
        }catch(error){reject(error);}
      });
      if(response.statusCode!==200){response.resume();throw Error("北极星客户端下载失败：HTTP "+response.statusCode);}
      const announced=response.headers["content-length"];
      if(announced!==undefined&&(!/^\d+$/.test(String(announced))||!Number.isSafeInteger(Number(announced))))throw Error("北极星客户端下载中断");
      const length=announced===undefined?null:Number(announced);
      if(length!==null&&length>MAX_ZIP)throw Error("北极星客户端压缩包体积超出上限");
      const limiter=new (require("stream").Transform)({transform:(chunk,_encoding,callback)=>{
        bytes+=chunk.length;
        if(bytes>MAX_ZIP||length!==null&&bytes>length){callback(Error("北极星客户端压缩包体积超出上限"));return;}
        try{this.progress({phase:"downloading",region:release.region,percent:length?Math.min(100,Math.floor(bytes/length*100)):0});}catch(_){}
        callback(null,chunk);
      }});
      const output=fs.createWriteStream(target,{flags:"wx"});output.once("open",()=>{ownsFile=true;});
      await require("stream/promises").pipeline(response,limiter,output);
      if(bytes===0||length!==null&&bytes!==length||response.complete===false)throw Error("北极星客户端下载中断");
      const digest=await hashFile(target);if(release.digest&&digest!==release.digest)throw Error("北极星客户端下载校验失败");return digest;
    }catch(error){request?.destroy();response?.destroy();if(ownsFile)await fsp.rm(target,{force:true});throw error;}
    finally{clearTimeout(timer);}
  }
  async update(release) {
    const channel = release.region;
    if (!["cn","global"].includes(channel)) throw Error("北极星更新频道无效");
    const parent = path.join(this.cacheRoot,"updates"); await this.safeCachePath(parent); await fsp.mkdir(parent,{recursive:true});
    const stage = await fsp.mkdtemp(path.join(parent,"download-"));
    try {
      const archive = path.join(stage,"release.zip"), digest = await this.download(release,archive);
      const rows = listing(await this.tool(["l","-slt","-sccUTF-8",archive]));
      const prefix = rows.some(row => row.path === "NorthstarLauncher.exe") ? "" : rows.some(row => row.path === "Northstar/NorthstarLauncher.exe") ? "Northstar/" : null;
      if (prefix === null) throw Error("北极星压缩包缺少客户端启动文件");
      const selected = rows.filter(row => !row.directory && row.path.startsWith(prefix)).map(row => ({...row,relative:row.path.slice(prefix.length)})).filter(row => ownedPath(row.relative));
      if (selected.some(row => row.size > 128*1024*1024) || selected.reduce((sum,row)=>sum+row.size,0)>MAX_PAYLOAD) throw Error("北极星客户端文件体积超出上限");
      const unpack = path.join(stage,"extracted"); await fsp.mkdir(unpack); await this.extract(archive,unpack,selected.map(row=>row.path));
      const payload = path.join(stage,"payload"); await fsp.rename(prefix ? path.join(unpack,"Northstar") : unpack,payload);
      const files = [];
      for (const row of selected) {const filename=path.join(payload,...row.relative.split("/")), stat=await fsp.lstat(filename);if(!stat.isFile()||stat.isSymbolicLink()||stat.size!==row.size)throw Error("北极星客户端解压校验失败");files.push({path:row.relative,size:stat.size,sha256:await hashFile(filename)});}
      const manifest = validateManifest({schemaVersion:1,channel,version:release.version.replace(/^v/,""),profile:"R2Northstar",ownedDirectories:CORE_DIRS,files,source:{url:release.download_link,archiveSha256:digest,repository:channel==="global"?"R2Northstar/Northstar":"R2NorthstarCN/R2NorthstarCN_Launcher"}},channel);
      await writeJson(path.join(stage,"manifest.json"),manifest); await validateBundle(stage,channel);
      await fsp.rm(archive); await fsp.rm(unpack,{recursive:true,force:true});
      const identity = sha(Buffer.from(JSON.stringify(manifest))), destination = path.join(parent,identity);
      await this.safeCachePath(destination);
      if (fs.existsSync(destination)) {if((await validateBundle(destination,channel)).digest!==identity)throw Error("北极星更新缓存清单与来源不一致");} else await fsp.rename(stage,destination);
      await writeJson(path.join(parent,channel+".json"),{channel,directory:identity}); return destination;
    } finally {await fsp.rm(stage,{recursive:true,force:true});}
  }
}
module.exports = {ClientBundleCache,listing,cleanPath,hashFile,trustedRedirect};
