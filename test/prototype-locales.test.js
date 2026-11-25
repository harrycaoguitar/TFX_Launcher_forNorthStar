'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function setup(){
 const window={addEventListener(){},dispatchEvent(){}},context={window,document:{body:null},fold:{normalizeUiLanguage:v=>v,loadSettings:()=>({data:{uiLanguage:'en-US'}}),loadLocale:locale=>JSON.parse(fs.readFileSync(path.join(__dirname,'../src/lang/ui-'+locale+'.json'),'utf8')).strings,translateText:v=>v,translate:v=>v,setUiLanguage(){}},ipcRenderer:{on(){}},MutationObserver:class{observe(){}disconnect(){}},CustomEvent:class{},requestAnimationFrame:()=>0};
 vm.createContext(context);
 for(const file of ['js/locales.js','prototype/locales.js','js/i18n.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/app',file),'utf8'),context,{filename:file});
 return window;
}
test('desktop UI copy and templated diagnostics translate into every supported locale',()=>{
 const w=setup();
 for(const[zh,en]of w.TFXLocaleConfig.pairs){
  assert.equal(w.I18n.text(zh,'en-US'),en,zh);
  for(const locale of ['de-DE','fr-FR','zh-TW'])assert.equal(w.I18n.text(zh,locale),w.TFXLocaleConfig.strings[locale][en],locale+' '+zh);
 }
 for(const locale of ['en-US','de-DE','fr-FR']){
  for(const value of ['25 个服务器  /  70 位铁驭在线','最近诊断 17.11.2026, 14:20:10','诊断完成，2 项待处理。','启动桥接已修复；检查通过。','EA 登录站点响应 54 ms；不代表账户已获授权。'])assert.doesNotMatch(w.I18n.text(value,locale),/\p{Script=Han}/u,locale+' '+value);
 }
});
test('user content and internal identifiers retain their values inside localized messages',()=>{
 const w=setup(),name='我的模组 Ω.zip',file='D:\\游戏\\mods\\test.dds';
 for(const locale of ['zh-CN','zh-TW','en-US','de-DE','fr-FR']){
  assert.equal(w.I18n.text(file,locale),file);
  assert.equal(w.I18n.text(name,locale),name);
  assert.ok(w.I18n.text('卸载模组：'+name+'？',locale).includes(name));
  assert.ok(w.I18n.text('当前 Northstar 1.17.7',locale).includes('1.17.7'));
 }
});
