const {app,BrowserWindow,ipcMain,dialog,session,Menu}=require('electron');
const fs=require('fs'),path=require('path');
let win;
const pdfArg=a=>a.slice(1).find(x=>/\.pdf$/i.test(x)&&fs.existsSync(x));
const send=f=>{if(f&&win)win.webContents.send('open',path.basename(f),fs.readFileSync(f))};
if(!app.requestSingleInstanceLock())app.quit();
app.on('second-instance',(e,argv)=>{if(win){if(win.isMinimized())win.restore();win.focus();send(pdfArg(argv))}});
app.whenReady().then(()=>{
 Menu.setApplicationMenu(null);
 session.defaultSession.setPermissionRequestHandler((w,p,cb)=>cb(true));
 session.defaultSession.setPermissionCheckHandler(()=>true);
 win=new BrowserWindow({width:1280,height:850,backgroundColor:'#f1f3f6',autoHideMenuBar:true,
  webPreferences:{preload:path.join(__dirname,'preload.js')}});
 win.loadFile('index.html');
 win.webContents.once('did-finish-load',()=>win.webContents.executeJavaScript('window.initFonts&&window.initFonts()',true).catch(()=>{}).then(()=>send(pdfArg(process.argv))));
});
app.on('window-all-closed',()=>app.quit());
ipcMain.handle('save',async(e,name,data)=>{
 const r=await dialog.showSaveDialog(win,{defaultPath:name,filters:[{name:'PDF',extensions:['pdf']}]});
 if(!r.canceled)fs.writeFileSync(r.filePath,Buffer.from(data));
});

/* ---------- learning memory + persistent font cache (survive restarts / updates) ---------- */
const dataDir=()=>{const d=path.join(app.getPath('userData'),'learned');fs.mkdirSync(path.join(d,'fonts'),{recursive:true});return d};
const memFile=()=>path.join(dataDir(),'memory.json'),fontDir=()=>path.join(dataDir(),'fonts'),idxFile=()=>path.join(fontDir(),'index.json');
const readJ=(f,d)=>{try{return JSON.parse(fs.readFileSync(f,'utf8'))}catch(e){return d}};
const writeJ=(f,o)=>{const t=f+'.tmp';fs.writeFileSync(t,JSON.stringify(o));fs.renameSync(t,f)};
ipcMain.handle('mem:get',()=>readJ(memFile(),{}));
ipcMain.handle('mem:set',(e,o)=>{writeJ(memFile(),o);return true});
ipcMain.handle('font:list',()=>readJ(idxFile(),[]).filter(x=>fs.existsSync(path.join(fontDir(),x.file))));
ipcMain.handle('font:read',(e,file)=>{const p=path.join(fontDir(),path.basename(file));return fs.existsSync(p)?fs.readFileSync(p):null});
const slug=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
function addIndex(ent){const ix=readJ(idxFile(),[]).filter(x=>!(x.family===ent.family&&x.weight===ent.weight&&x.italic===ent.italic));ix.push(ent);writeJ(idxFile(),ix)}
ipcMain.handle('font:save',(e,family,weight,italic,name,data)=>{
 const ext=(path.extname(name)||'.ttf').toLowerCase(),file=`${slug(family)}-${weight}${italic?'i':''}${ext}`;
 fs.writeFileSync(path.join(fontDir(),file),Buffer.from(data));addIndex({family,weight,italic:!!italic,file,src:'user',date:Date.now()});return file});
const UA='curl/8.5.0'; // makes Google Fonts answer with plain TrueType files
async function dl(url){const r=await fetch(url,{headers:{'User-Agent':UA}});if(!r.ok)throw new Error(r.status);return r}
function parseCss(css){const out=[];for(const m of css.matchAll(/@font-face\s*\{([^}]*)\}/g)){const b=m[1],u=/url\(['"]?([^)'"]+)['"]?\)/.exec(b),w=/font-weight:\s*(\d+)/.exec(b),s=/font-style:\s*(\w+)/.exec(b);
  if(u)out.push({url:u[1],weight:w?+w[1]:400,italic:!!s&&s[1]==='italic',pre:css.slice(Math.max(0,m.index-20),m.index)})}return out}
/* download a family (regular + bold) once and keep it forever */
ipcMain.handle('font:fetch',async(e,family,cssUrl)=>{
 const have=readJ(idxFile(),[]).filter(x=>x.family===family&&fs.existsSync(path.join(fontDir(),x.file)));
 if(have.length)return have;
 const q=encodeURIComponent(family).replace(/%20/g,'+');
 const urls=cssUrl?[cssUrl]:[`https://fonts.googleapis.com/css2?family=${q}:wght@400;700`,`https://fonts.googleapis.com/css?family=${q}:400,700`,`https://fonts.googleapis.com/css?family=${q}`];
 for(const cu of urls){try{
  const faces=parseCss(await(await dl(cu)).text());if(!faces.length)continue;
  const want=[400,700],done=new Set(),res=[];
  for(const wt of want){
   let c=faces.filter(f=>!f.italic&&(f.weight===wt||(f.weight<=wt&&wt===400)));if(!c.length&&wt===400)c=faces.filter(f=>!f.italic);if(!c.length)continue;
   const pick=c.find(f=>/bengali/i.test(f.pre))||c.find(f=>!/latin|cyrillic|greek|vietnamese|devanagari/i.test(f.pre))||c[0];
   if(done.has(pick.url))continue;done.add(pick.url);
   const buf=Buffer.from(await(await dl(pick.url)).arrayBuffer()),ext=/\.otf/i.test(pick.url)?'.otf':'.ttf',file=`${slug(family)}-${wt}${ext}`;
   fs.writeFileSync(path.join(fontDir(),file),buf);const ent={family,weight:wt,italic:false,file,src:cu,date:Date.now()};addIndex(ent);res.push(ent)}
  if(res.length)return res}catch(err){}}
 return[]});
