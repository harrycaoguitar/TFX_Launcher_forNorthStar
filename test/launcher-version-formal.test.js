"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const Module=require("node:module");
const fs=require("node:fs");
const path=require("node:path");

test("launcher runtime, fallback, and UI version stay on the same source",()=>{
  const original=Module._load;
  let runtimeVersion="1.0.7";
  try {
    Module._load=function(request,parent,isMain){
      if(request==="electron") return {app:{getVersion:()=>runtimeVersion}};
      return original.call(this,request,parent,isMain);
    };
    const helperPath=path.resolve(__dirname,"../src/modules/launcher-version.js");
    delete require.cache[helperPath];
    const current=require(helperPath);
    assert.equal(current(),"1.0.7");
    runtimeVersion="1.0.8";
    assert.equal(current(),"1.0.8");
    runtimeVersion="";
    assert.equal(current(),require("../package.json").version);
    for(const rel of ["src/modules/version.js","src/modules/launcher-update.js","src/modules/launch.js","src/index.js"]){
      const source=fs.readFileSync(path.resolve(__dirname,"..",rel),"utf8");
      assert(!source.includes('require("../../package.json").version'),rel+" reads a second version source");
    }
    const html=fs.readFileSync(path.resolve(__dirname,"../src/app/index.html"),"utf8");
    const renderer=fs.readFileSync(path.resolve(__dirname,"../src/app/main.js"),"utf8");
    assert(html.includes('id="launcherEditionVersion" data-i18n-ignore'));
    assert(!html.includes('data-i18n="app.preview">1.0.5'));
    assert(renderer.includes('launcherEditionVersion.innerText = String(versions.vp).replace(/^v/, "")'));
  } finally {
    Module._load=original;
  }
});
