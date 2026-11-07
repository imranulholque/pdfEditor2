/* Rewrites a page's content stream: each lifted shape/picture is replaced IN PLACE (same z-order, so text that sat
   on top of it stays on top) by a vector copy at its new position/size/colour. Unmatched ones are appended on top. */
(function(root){
const P={};
const latin1=u=>{let s='';for(let i=0;i<u.length;i+=8192)s+=String.fromCharCode.apply(null,u.subarray(i,i+8192));return s};
const toBytes=s=>{const u=new Uint8Array(s.length);for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i)&255;return u};
const f4=v=>{const t=(+v).toFixed(4);return t.indexOf('.')<0?t:t.replace(/0+$/,'').replace(/\.$/,'')||'0'};
P.f4=f4;
P.pageSource=function(PL,doc,page){
 const cont=page.node.Contents(),parts=[];
 if(cont&&cont.size&&cont.lookup){for(let i=0;i<cont.size();i++)parts.push(cont.lookup(i))}else if(cont)parts.push(cont);
 return parts.map(s=>latin1(s.getUnencodedContents?s.getUnencodedContents():PL.decodePDFRawStream(s).decode())).join('\n')};
/* items: [{k:'p'|'i', rb:{x0,y0,x1,y1} user-space bbox of the original, M: local->user matrix, build(cm)->string, cover:'q ..Q' string|''}] */
P.rebuild=function(PL,doc,page,items){
 if(!items.length)return{inplace:0,late:0};
 const src=P.pageSource(PL,doc,page),ops=CS.scan(src),used=new Set(),edits=[],late=[];let inplace=0;
 for(const it of items){
  const m=CS.match(ops,it.k,it.rb,used);
  if(m){used.add(m.n);
   if(m.op.full&&!m.clip){edits.push({s:m.op.s,e:m.op.e,rep:'\n'+it.build(CS.mul(it.M,CS.inv(m.ctm)))+'\n'});inplace++;continue}
   edits.push({s:m.op.s,e:m.op.e,rep:m.op.full?'':(m.k==='p'?'n':'')});late.push({it,cover:''})}
  else late.push({it,cover:it.cover||''})}
 const ref=doc.context.register(doc.context.flateStream(toBytes('q\n'+CS.edit(src,edits)+'\nQ\n')));
 page.node.set(PL.PDFName.of('Contents'),ref);
 if(late.length){const s=late.map(l=>l.cover+l.it.build(l.it.M)).join('\n');
  page.node.addContentStream(doc.context.register(doc.context.flateStream(toBytes(s))))}
 return{inplace,late:late.length}};
/* append raw operators (vector text etc.) as the last layer of the page */
P.append=function(PL,doc,page,str){if(str)page.node.addContentStream(doc.context.register(doc.context.flateStream(toBytes('q\n'+str+'\nQ\n'))))};
P.shapeStr=function(S,d,el,cm,gs){
 const rg=h=>{const a=[1,3,5].map(i=>parseInt(h.substr(i,2),16)/255);return a.map(f4).join(' ')};
 const su=el.w/S.w,sv=el.h/S.h,lw=+d.lw||0,hasS=!!d.stroke&&lw>0,fill=d.fill;
 let s='q '+cm.map(f4).join(' ')+' cm\n';if(gs)s+=gs+' gs\n';
 s+=`0 0 m ${f4(S.w)} 0 l ${f4(S.w)} ${f4(S.h)} l 0 ${f4(S.h)} l h W n\n`;
 if(fill)s+=rg(fill)+' rg\n';
 if(hasS)s+=rg(d.stroke)+' RG '+f4(lw/((su+sv)/2))+' w [] 0 d\n';
 for(const c of S.cmds){if(c[0]==='M')s+=f4(c[1])+' '+f4(c[2])+' m\n';else if(c[0]==='L')s+=f4(c[1])+' '+f4(c[2])+' l\n';
  else if(c[0]==='C')s+=c.slice(1).map(f4).join(' ')+' c\n';else s+='h\n'}
 s+=(fill&&hasS?(S.eo?'B*':'B'):fill?(S.eo?'f*':'f'):hasS?'S':'n')+'\nQ';return s};
P.imageStr=(name,cm)=>'q '+cm.map(f4).join(' ')+' cm '+name+' Do Q';
if(typeof module!=='undefined')module.exports=P;else root.PO=P;
})(typeof self!=='undefined'?self:this);
