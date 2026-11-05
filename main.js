const {app,BrowserWindow,ipcMain,dialog,session}=require('electron');
const fs=require('fs'),path=require('path');
let win;
const pdfArg=a=>a.slice(1).find(x=>/\.pdf$/i.test(x)&&fs.existsSync(x));
const send=f=>{if(f&&win)win.webContents.send('open',path.basename(f),fs.readFileSync(f))};
if(!app.requestSingleInstanceLock())app.quit();
app.on('second-instance',(e,argv)=>{if(win){if(win.isMinimized())win.restore();win.focus();send(pdfArg(argv))}});
app.whenReady().then(()=>{
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
