const U=require('../lib/updater.js'),fs=require('fs'),os=require('os'),path=require('path'),assert=require('assert'),cp=require('child_process');
(async()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'upd-'));
 // 1. our SHA equals real git's
 const sample=Buffer.from('hello\nworld\n');fs.writeFileSync(tmp+'/s.txt',sample);
 let gitSha=null;try{gitSha=cp.execSync('git hash-object s.txt',{cwd:tmp}).toString().trim()}catch(e){}
 assert.strictEqual(U.gitSha(sample),gitSha||U.gitSha(sample));
 // 2. whitelist
 for(const ok of['index.html','js/bn.js','knowledge/fixes.json'])assert(U.ALLOW.test(ok),ok);
 for(const bad of['main.js','preload.js','package.json','lib/updater.js','js/../main.js','js/a/b.js','node_modules/x.js','knowledge/x.js','index.html.bak'])assert(!U.ALLOW.test(bad),bad);
 // 3. resolve: hot wins for whitelisted, never escapes root
 const hot=path.join(tmp,'hot'),base=path.join(tmp,'base');fs.mkdirSync(hot+'/js',{recursive:true});fs.mkdirSync(base+'/js',{recursive:true});fs.mkdirSync(base+'/node_modules',{recursive:true});
 fs.writeFileSync(hot+'/js/a.js','HOT');fs.writeFileSync(base+'/js/a.js','BASE');fs.writeFileSync(base+'/node_modules/p.js','NM');fs.writeFileSync(hot+'/main.js','EVIL');fs.writeFileSync(base+'/main.js','OK');
 assert.strictEqual(fs.readFileSync(U.resolve('js/a.js',hot,base,true),'utf8'),'HOT');
 assert.strictEqual(fs.readFileSync(U.resolve('js/a.js',hot,base,false),'utf8'),'BASE');
 assert.strictEqual(fs.readFileSync(U.resolve('main.js',hot,base,true),'utf8'),'OK','non-whitelisted hot file ignored');
 assert.strictEqual(U.resolve('node_modules/p.js',hot,base,true),path.join(base,'node_modules/p.js'));
 assert.strictEqual(U.resolve('../x',hot,base,true),null);assert.strictEqual(U.resolve('js/../../x',hot,base,true),null);
 // 4. sync against a fake GitHub
 const files={'index.html':Buffer.from('<html>v1</html>'),'js/bn.js':Buffer.from('//bn v1'),'knowledge/fixes.json':Buffer.from('{}'),'main.js':Buffer.from('EVIL'),'js/readme.md':Buffer.from('x')};
 const mkFetch=(tamper)=>async(u)=>{
  const ok=j=>({ok:true,status:200,json:async()=>j});
  if(u.includes('/git/trees/'))return ok({sha:'T1',truncated:false,tree:Object.entries(files).map(([p,b])=>({path:p,type:'blob',sha:U.gitSha(b),size:b.length}))});
  const m=/blobs\/(\w+)/.exec(u);const e=Object.entries(files).find(([p,b])=>U.gitSha(b)===m[1]);
  return ok({encoding:'base64',content:(tamper?Buffer.from('tampered'):e[1]).toString('base64')})};
 const cfg={repo:'me/pdfEditor2',branch:'main',hotRoot:path.join(tmp,'hot2'),idxFile:path.join(tmp,'hot2.json'),fetch:mkFetch(false)};
 let r=await U.sync(cfg);assert.strictEqual(r.changed,3);assert(!fs.existsSync(cfg.hotRoot+'/main.js'),'main.js never synced');assert(!fs.existsSync(cfg.hotRoot+'/js/readme.md'));
 assert.strictEqual(fs.readFileSync(cfg.hotRoot+'/js/bn.js','utf8'),'//bn v1');
 r=await U.sync(cfg);assert.strictEqual(r.changed,0,'nothing to do when up to date');
 files['js/bn.js']=Buffer.from('//bn v2');r=await U.sync(cfg);assert.deepStrictEqual(r.files,['js/bn.js']);assert.strictEqual(fs.readFileSync(cfg.hotRoot+'/js/bn.js','utf8'),'//bn v2');
 delete files['knowledge/fixes.json'];r=await U.sync(cfg);assert.strictEqual(r.removed,1);assert(!fs.existsSync(cfg.hotRoot+'/knowledge/fixes.json'));
 // 5. tampered download is rejected and leaves the old version untouched
 files['js/bn.js']=Buffer.from('//bn v3');cfg.fetch=mkFetch(true);
 await assert.rejects(()=>U.sync(cfg),/Integrity/);assert.strictEqual(fs.readFileSync(cfg.hotRoot+'/js/bn.js','utf8'),'//bn v2');assert(!fs.existsSync(cfg.hotRoot+'.stage'));
 await assert.rejects(()=>U.sync({...cfg,repo:'bad repo'}),/owner\/repo/);
 console.log('updater ok');
})().catch(e=>{console.error(e);process.exit(1)});
