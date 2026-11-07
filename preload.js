const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('api',{
 onOpen:cb=>ipcRenderer.on('open',(e,n,b)=>cb(n,b)),
 save:(n,b)=>ipcRenderer.invoke('save',n,b),
 memGet:()=>ipcRenderer.invoke('mem:get'),memSet:o=>ipcRenderer.invoke('mem:set',o),
 fontList:()=>ipcRenderer.invoke('font:list'),fontRead:f=>ipcRenderer.invoke('font:read',f),
 fontSave:(fam,w,it,name,data)=>ipcRenderer.invoke('font:save',fam,w,it,name,data),
 fontFetch:(fam,css)=>ipcRenderer.invoke('font:fetch',fam,css),
 cfgGet:()=>ipcRenderer.invoke('cfg:get'),cfgSet:o=>ipcRenderer.invoke('cfg:set',o),
 updCheck:()=>ipcRenderer.invoke('upd:check'),updReload:()=>ipcRenderer.invoke('upd:reload'),
 onUpdate:cb=>ipcRenderer.on('update-ready',(e,r)=>cb(r)),
 aiRead:o=>ipcRenderer.invoke('ai:read',o),
 ready:()=>ipcRenderer.send('app:ready'),crash:m=>ipcRenderer.send('app:crash',m)
});
