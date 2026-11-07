const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('api',{
 onOpen:cb=>ipcRenderer.on('open',(e,n,b)=>cb(n,b)),
 save:(n,b)=>ipcRenderer.invoke('save',n,b),
 memGet:()=>ipcRenderer.invoke('mem:get'),
 memSet:o=>ipcRenderer.invoke('mem:set',o),
 fontList:()=>ipcRenderer.invoke('font:list'),
 fontRead:f=>ipcRenderer.invoke('font:read',f),
 fontSave:(fam,w,it,name,data)=>ipcRenderer.invoke('font:save',fam,w,it,name,data),
 fontFetch:(fam,css)=>ipcRenderer.invoke('font:fetch',fam,css)
});
