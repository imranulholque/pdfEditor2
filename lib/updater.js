/* Hot-update from GitHub: syncs ONLY index.html, js/*.js and knowledge/*.json from the configured repo into userData/hot.
   Every file is verified against GitHub's own git blob SHA-1, downloads are staged and committed atomically. */
const crypto=require('crypto'),fs=require('fs'),path=require('path');
const U={};
U.ALLOW=/^(index\.html|js\/[A-Za-z0-9._-]+\.js|knowledge\/[A-Za-z0-9._-]+\.json)$/;
U.gitSha=buf=>crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${buf.length}\0`),buf])).digest('hex');
/* hot copy wins for whitelisted files; everything else (node_modules, ...) comes from the installed app */
U.resolve=function(rel,hotRoot,baseRoot,useHot){
 rel=rel.replace(/^\/+/,'')||'index.html';
 if(rel.split('/').some(p=>p===''||p==='..'||p==='.'||p.includes('\\')))return null;
 if(useHot&&U.ALLOW.test(rel)){const h=path.join(hotRoot,rel);if(fs.existsSync(h)&&fs.statSync(h).isFile())return h}
 const b=path.join(baseRoot,rel);if(!b.startsWith(baseRoot))return null;
 try{if(fs.statSync(b).isFile())return b}catch(e){}return null};
const rmrf=p=>{try{fs.rmSync(p,{recursive:true,force:true})}catch(e){}};
U.sync=async function(o){
 const f=o.fetch||globalThis.fetch,{repo,branch='main',token,hotRoot,idxFile}=o;
 if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo||''))throw new Error('Set a valid "owner/repo" first');
 if(!/^[A-Za-z0-9_./-]+$/.test(branch))throw new Error('Bad branch name');
 const H={'User-Agent':'pdf-editor-updater',Accept:'application/vnd.github+json'};if(token)H.Authorization='Bearer '+token;
 const get=async u=>{const r=await f(u,{headers:H});if(!r.ok)throw new Error('GitHub '+r.status+' for '+u.replace('https://api.github.com',''));return r.json()};
 const tree=await get(`https://api.github.com/repos/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
 if(tree.truncated)throw new Error('Repository tree too large');
 const want=(tree.tree||[]).filter(x=>x.type==='blob'&&U.ALLOW.test(x.path)&&(x.size||0)<4e6);
 let idx={files:{}};try{idx=JSON.parse(fs.readFileSync(idxFile,'utf8'))}catch(e){}
 const todo=want.filter(x=>idx.files[x.path]!==x.sha||!fs.existsSync(path.join(hotRoot,x.path)));
 const gone=Object.keys(idx.files).filter(p=>!want.some(x=>x.path===p));
 if(!todo.length&&!gone.length)return{changed:0,removed:0,total:want.length,files:[]};
 const stage=hotRoot+'.stage';rmrf(stage);
 try{
  for(const x of todo){
   const b=await get(`https://api.github.com/repos/${repo}/git/blobs/${x.sha}`),buf=Buffer.from(b.content||'',b.encoding==='base64'?'base64':'utf8');
   if(U.gitSha(buf)!==x.sha)throw new Error('Integrity check failed for '+x.path);
   const t=path.join(stage,x.path);fs.mkdirSync(path.dirname(t),{recursive:true});fs.writeFileSync(t,buf)}
  for(const x of todo){const t=path.join(hotRoot,x.path);fs.mkdirSync(path.dirname(t),{recursive:true});fs.renameSync(path.join(stage,x.path),t)}
  for(const p of gone)rmrf(path.join(hotRoot,p));
  const nf={};want.forEach(x=>nf[x.path]=x.sha);
  fs.writeFileSync(idxFile,JSON.stringify({files:nf,tree:tree.sha,at:Date.now(),repo,branch}));
 }finally{rmrf(stage)}
 return{changed:todo.length,removed:gone.length,total:want.length,files:todo.map(x=>x.path)}};
if(typeof module!=='undefined')module.exports=U;
