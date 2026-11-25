'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {palettes,defaultId,normalize}=require('../src/app/prototype/palettes');
const preferences=require('../src/preferences');

function light(hex) {
  const channels=hex.slice(1).match(/../g).map(pair=>parseInt(pair,16)/255);
  const [red,green,blue]=channels.map(c=>c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4);
  return 0.2126*red+0.7152*green+0.0722*blue;
}
function ratio(a,b) {const levels=[light(a),light(b)].sort((x,y)=>y-x);return (levels[0]+0.05)/(levels[1]+0.05);}

test('all 17 ordered visual references can be saved, and retired themes migrate without changing other settings',()=>{
  assert.equal(palettes.length,17);
  assert.equal(new Set(palettes.map(p=>p.id)).size,17);
  assert.deepEqual(palettes.map(p=>p.number),Array.from({length:17},(_,i)=>i+1));
  for(const p of palettes)assert.equal(preferences.normalize({prototypeTheme:p.id}).prototypeTheme,p.id);
  for(const id of [undefined,'apricot','meadow','clay','sprout','ocean','lilac','violet','mint','retro','__proto__']){
    const settings=preferences.normalize({prototypeTheme:id,uiLanguage:'de-DE',gamepath:'D:/Titanfall2'});
    assert.equal(normalize(id),defaultId);
    assert.equal(settings.prototypeTheme,defaultId);
    assert.equal(settings.gamepath,'D:/Titanfall2');
    assert.equal(settings.uiLanguage,'de-DE');
  }
});

test('theme foregrounds and action labels keep at least 4.5:1 contrast on their base surfaces',()=>{
  for(const p of palettes){
    for(const [a,b] of [['text','bg'],['muted','bg'],['muted','surface'],['accent','bg'],['accent','surface'],['onAction','action']]){
      assert.ok(ratio(p[a],p[b])>=4.5,`${p.id}: ${a}/${b} = ${ratio(p[a],p[b]).toFixed(2)}`);
    }
  }
});
