const {app,BrowserWindow,ipcMain,dialog,session,Menu,protocol,safeStorage}=require('electron');
const fs=require('fs'),path=require('path'),U=require('./lib/updater.js');
protocol.registerSchemesAsPrivileged([{scheme:'app',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true,stream:true}}]);
let win,USE_HOT=true,ROLLED=false;
const pdfArg=a=>a.slice(1).find(x=>/\.pdf$/i.test(x)&&fs.existsSync(x));
const send=f=>{if(f&&win)win.webContents.send('open',path.basename(f),fs.readFileSync(f))};
if(!app.requestSingleInstanceLock())app.quit();
app.on('second-instance',(e,argv)=>{if(win){if(win.isMinimized())win.restore();win.focus();send(pdfArg(argv))}});

const ud=()=>app.getPath('userData');
const hotRoot=()=>path.join(ud(),'hot'),idxFile=()=>path.join(ud(),'hot.json'),cfgFile=()=>path.join(ud(),'config.json'),bootFile=()=>path.join(ud(),'boot.json');
const readJ=(f,d)=>{try{return JSON.parse(fs.readFileSync(f,'utf8'))}catch(e){return d}};
const writeJ=(f,o)=>{const t=f+'.tmp';fs.writeFileSync(t,JSON.stringify(o));fs.renameSync(t,f)};
const MIME={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.wasm':'application/wasm','.map':'application/json','.png':'image/png','.svg':'image/svg+xml','.ttf':'font/ttf','.woff2':'font/woff2','.bcmap':'application/octet-stream'};

/* ---------- config (API keys are encrypted with the OS keychain) ---------- */
const seal=s=>!s?'':safeStorage.isEncryptionAvailable()?'e:'+safeStorage.encryptString(s).toString('base64'):'p:'+Buffer.from(s).toString('base64');
const unseal=s=>{if(!s)return'';try{return s[0]==='e'?safeStorage.decryptString(Buffer.from(s.slice(2),'base64')):Buffer.from(s.slice(2),'base64').toString()}catch(e){return''}};
const cfg=()=>{const d=Object.assign({repo:'',branch:'main',model:'claude-sonnet-5-5',token:'',aiKey:''},(require('./package.json').pdfEditorUpdate||{}),readJ(cfgFile(),{}));return d};
ipcMain.handle('cfg:get',()=>{const c=cfg(),i=readJ(idxFile(),{});return{repo:c.repo,branch:c.branch,model:c.model,hasToken:!!c.token,hasKey:!!c.aiKey,version:app.getVersion(),hotAt:i.at||0,hotFiles:Object.keys(i.files||{}).length,rolledBack:ROLLED}});
ipcMain.handle('cfg:set',(e,o)=>{const c=readJ(cfgFile(),{});
 for(const k of['repo','branch','model'])if(typeof o[k]==='string')c[k]=o[k].trim();
 if(typeof o.token==='string'&&o.token!=='')c.token=seal(o.token.trim());if(o.clearToken)c.token='';
 if(typeof o.aiKey==='string'&&o.aiKey!=='')c.aiKey=seal(o.aiKey.trim());if(o.clearKey)c.aiKey='';
 writeJ(cfgFile(),c);return true});

/* ---------- hot update ---------- */
async function syncNow(){const c=cfg();return U.sync({repo:c.repo,branch:c.branch,token:unseal(c.token),hotRoot:hotRoot(),idxFile:idxFile()})}
ipcMain.handle('upd:check',async()=>{try{return{ok:true,...await syncNow()}}catch(e){return{ok:false,error:String(e.message||e)}}});
ipcMain.handle('upd:reload',()=>{if(win)win.loadURL('app://local/index.html');return true});

/* ---------- safety net: a hot version that never reports "ready" is thrown away ---------- */
function rollback(why){
 try{if(fs.existsSync(hotRoot())){fs.renameSync(hotRoot(),hotRoot()+'.bad-'+Date.now());fs.rmSync(idxFile(),{force:true})}}catch(e){}
 USE_HOT=false;ROLLED=why||true;writeJ(bootFile(),{pending:false})}
ipcMain.on('app:ready',()=>writeJ(bootFile(),{pending:false}));
ipcMain.on('app:crash',(e,msg)=>{if(readJ(bootFile(),{}).pending&&fs.existsSync(hotRoot())){rollback(String(msg||'crash'));if(win)win.loadURL('app://local/index.html')}});

/* ---------- AI assist: read a cropped line image with Claude (opt-in, only crops you click on are sent) ---------- */
ipcMain.handle('ai:read',async(e,o)=>{
 const c=cfg(),key=unseal(c.aiKey);if(!key)return{ok:false,error:'Add your Claude API key in ⚙ settings first'};
 try{
  const content=[];(o.images||[]).forEach((b,i)=>{content.push({type:'text',text:`Image ${i+1}:`},{type:'image',source:{type:'base64',media_type:'image/png',data:b}})});
  content.push({type:'text',text:'Transcribe the text exactly as it appears in each image.'+(o.hint?' Hint (may contain errors): '+o.hint:'')});
  const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'x-api-key':key,'anthropic-version':'2023-06-01','content-type':'application/json'},
   body:JSON.stringify({model:c.model||'claude-sonnet-5-5',max_tokens:1500,
    system:'You are an OCR engine for a PDF editor. Each image is one line of text cut from a PDF page (Bengali and/or English). Return ONLY JSON: {"lines":["..."]} with one string per image, same order. Write Bengali in correct Unicode logical order (consonant before its vowel sign). Keep spaces between words exactly as shown. Never translate, correct, or add anything.',
    messages:[{role:'user',content}]})});
  const j=await r.json();if(!r.ok)return{ok:false,error:(j.error&&j.error.message)||('HTTP '+r.status)};
  const t=(j.content||[]).map(x=>x.text||'').join(''),m=/\{[\s\S]*\}/.exec(t);if(!m)return{ok:false,error:'No JSON in reply'};
  const lines=JSON.parse(m[0]).lines;return Array.isArray(lines)?{ok:true,lines}:{ok:false,error:'Bad reply'}
 }catch(err){return{ok:false,error:String(err.message||err)}}});

app.whenReady().then(()=>{
 Menu.setApplicationMenu(null);
 const st=readJ(bootFile(),{});if(st.pending&&fs.existsSync(hotRoot()))rollback('previous start never finished');
 writeJ(bootFile(),{pending:true,ts:Date.now()});
 protocol.handle('app',req=>{
  const rel=decodeURIComponent(new URL(req.url).pathname),f=U.resolve(rel,hotRoot(),__dirname,USE_HOT);
  if(!f)return new Response('Not found',{status:404});
  return new Response(fs.readFileSync(f),{headers:{'content-type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream','cache-control':'no-store'}})});
 session.defaultSession.setPermissionRequestHandler((w,p,cb)=>cb(true));
 session.defaultSession.setPermissionCheckHandler(()=>true);
 win=new BrowserWindow({width:1280,height:850,backgroundColor:'#f1f3f6',autoHideMenuBar:true,
  webPreferences:{preload:path.join(__dirname,'preload.js')}});
 win.loadURL('app://local/index.html');
 win.webContents.once('did-finish-load',()=>{
  win.webContents.executeJavaScript('window.initFonts&&window.initFonts()',true).catch(()=>{}).then(()=>send(pdfArg(process.argv)));
  const c=cfg();if(c.repo)syncNow().then(r=>{if(r.changed||r.removed)win.webContents.send('update-ready',r)}).catch(()=>{});
 });
});
app.on('window-all-closed',()=>app.quit());
ipcMain.handle('save',async(e,name,data)=>{
 const r=await dialog.showSaveDialog(win,{defaultPath:name,filters:[{name:'PDF',extensions:['pdf']}]});
 if(!r.canceled)fs.writeFileSync(r.filePath,Buffer.from(data));
});

/* ---------- learning memory + persistent font cache ---------- */
const dataDir=()=>{const d=path.join(ud(),'learned');fs.mkdirSync(path.join(d,'fonts'),{recursive:true});return d};
const memFile=()=>path.join(dataDir(),'memory.json'),fontDir=()=>path.join(dataDir(),'fonts'),fIdx=()=>path.join(fontDir(),'index.json');
ipcMain.handle('mem:get',()=>readJ(memFile(),{}));
ipcMain.handle('mem:set',(e,o)=>{writeJ(memFile(),o);return true});
ipcMain.handle('font:list',()=>readJ(fIdx(),[]).filter(x=>fs.existsSync(path.join(fontDir(),x.file))));
ipcMain.handle('font:read',(e,file)=>{const p=path.join(fontDir(),path.basename(file));return fs.existsSync(p)?fs.readFileSync(p):null});
const slug=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
function addIndex(ent){const ix=readJ(fIdx(),[]).filter(x=>!(x.family===ent.family&&x.weight===ent.weight&&x.italic===ent.italic));ix.push(ent);writeJ(fIdx(),ix)}
ipcMain.handle('font:save',(e,family,weight,italic,name,data)=>{
 const ext=(path.extname(name)||'.ttf').toLowerCase(),file=`${slug(family)}-${weight}${italic?'i':''}${ext}`;
 fs.writeFileSync(path.join(fontDir(),file),Buffer.from(data));addIndex({family,weight,italic:!!italic,file,src:'user',date:Date.now()});return file});
const UA='curl/8.5.0';
async function dl(url){const r=await fetch(url,{headers:{'User-Agent':UA}});if(!r.ok)throw new Error(r.status);return r}
function parseCss(css){const out=[];for(const m of css.matchAll(/@font-face\s*\{([^}]*)\}/g)){const b=m[1],u=/url\(['"]?([^)'"]+)['"]?\)/.exec(b),w=/font-weight:\s*(\d+)/.exec(b),s=/font-style:\s*(\w+)/.exec(b);
  if(u)out.push({url:u[1],weight:w?+w[1]:400,italic:!!s&&s[1]==='italic',pre:css.slice(Math.max(0,m.index-20),m.index)})}return out}
ipcMain.handle('font:fetch',async(e,family,cssUrl)=>{
 const have=readJ(fIdx(),[]).filter(x=>x.family===family&&fs.existsSync(path.join(fontDir(),x.file)));
 if(have.length)return have;
 const q=encodeURIComponent(family).replace(/%20/g,'+');
 const urls=cssUrl?[cssUrl]:[`https://fonts.googleapis.com/css2?family=${q}:wght@400;700`,`https://fonts.googleapis.com/css?family=${q}:400,700`,`https://fonts.googleapis.com/css?family=${q}`];
 for(const cu of urls){try{
  const faces=parseCss(await(await dl(cu)).text());if(!faces.length)continue;
  const done=new Set(),res=[];
  for(const wt of[400,700]){
   let c=faces.filter(f=>!f.italic&&(f.weight===wt||(f.weight<=wt&&wt===400)));if(!c.length&&wt===400)c=faces.filter(f=>!f.italic);if(!c.length)continue;
   const pick=c.find(f=>/bengali/i.test(f.pre))||c.find(f=>!/latin|cyrillic|greek|vietnamese|devanagari/i.test(f.pre))||c[0];
   if(done.has(pick.url))continue;done.add(pick.url);
   const buf=Buffer.from(await(await dl(pick.url)).arrayBuffer()),ext=/\.otf/i.test(pick.url)?'.otf':'.ttf',file=`${slug(family)}-${wt}${ext}`;
   fs.writeFileSync(path.join(fontDir(),file),buf);const ent={family,weight:wt,italic:false,file,src:cu,date:Date.now()};addIndex(ent);res.push(ent)}
  if(res.length)return res}catch(err){}}
 return[]});
