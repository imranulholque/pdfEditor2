const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('api',{
 onOpen:cb=>ipcRenderer.on('open',(e,n,b)=>cb(n,b)),
 save:(n,b)=>ipcRenderer.invoke('save',n,b)
});
