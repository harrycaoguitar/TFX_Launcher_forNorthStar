const fs=require('fs');
for(const file of process.argv.slice(2)) {
  const json=JSON.parse(fs.readFileSync(file,'utf8'));
  json.version='1.0.7';
  if(file.endsWith('package-lock.json')&&json.packages&&json.packages['']) json.packages[''].version='1.0.7';
  fs.writeFileSync(file,JSON.stringify(json,null,2)+'\n','utf8');
}
