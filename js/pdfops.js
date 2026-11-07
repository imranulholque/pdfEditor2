/* Rewrites a page's content stream: each lifted shape/picture is replaced IN PLACE (same z-order, so text that sat
   on top of it stays on top) by a vector copy at its new position/size/colour. Unmatched ones are appended on top. */
(function(root){
const P={};
const latin1=u=>{let s='';for(let i=0;i<u.length;i+=8192)s+=String.fromCharCode.apply(null,u.subarray(i,i+8192));return s};
const toBytes=s=>{const u=new Uint8Array(s.length);for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i)&255;return u};
const f4=v=>{const t=(+v).toFixed(4);return t.indexOf('.')<0?t:t.replace(/0+$/,'').replace(/\.$/,'')||'0'};
P.f4=f4;

/* ---- original-font text: encode new text with the PDF's own font (via its ToUnicode map) ---- */
const hexU=h=>{let o='';for(let i=0;i+3<h.length;i+=4)o+=String.fromCharCode(parseInt(h.substr(i,4),16));return o};
P.parseToUnicode=function(txt){
 const map=new Map(),H='<([0-9A-Fa-f]+)>';
 for(const b of txt.matchAll(/beginbfchar([\s\S]*?)endbfchar/g))for(const m of b[1].matchAll(new RegExp(H+'\\s*'+H,'g')))map.set(m[1],{n:m[1].length,u:hexU(m[2].padStart(4,'0'))});
 for(const b of txt.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)){
  for(const m of b[1].matchAll(new RegExp(H+'\\s*'+H+'\\s*(\\[[^\\]]*\\]|'+H+')','g'))){
   const n=m[1].length,lo=parseInt(m[1],16),hi=parseInt(m[2],16);
   if(m[3][0]==='['){const ds=[...m[3].matchAll(/<([0-9A-Fa-f]+)>/g)];for(let c=lo;c<=hi&&c-lo<ds.length;c++)map.set(c.toString(16).toUpperCase().padStart(n,'0'),{n,u:hexU(ds[c-lo][1].padStart(4,'0'))})}
   else{const d=m[4];let u=hexU(d.padStart(4,'0'));for(let c=lo;c<=hi&&c-lo<65536;c++){const cs=u.slice(0,-1)+String.fromCharCode(u.charCodeAt(u.length-1)+(c-lo));map.set(c.toString(16).toUpperCase().padStart(n,'0'),{n,u:cs})}}}}
 return map};
P.codec=function(PL,doc,page,name){
 try{const res=page.node.Resources(),fonts=res&&res.lookupMaybe(PL.PDFName.of('Font'),PL.PDFDict),fd=fonts&&fonts.lookupMaybe(PL.PDFName.of(name),PL.PDFDict);if(!fd)return null;
  const tu=fd.lookupMaybe(PL.PDFName.of('ToUnicode'),PL.PDFRawStream,PL.PDFStream);if(!tu)return null;
  const bytes=tu.getUnencodedContents?tu.getUnencodedContents():PL.decodePDFRawStream(tu).decode();
  const map=P.parseToUnicode(latin1(bytes)),rev=new Map();
  for(const[code,v]of map)if(v.u.length===1&&!rev.has(v.u))rev.set(v.u,code);
  if(!rev.size)return null;
  return{encode:t=>{let o='';for(const ch of Array.from(t)){if(ch.length!==1)return null;const c=rev.get(ch);if(!c)return null;o+=c}return o},chars:rev.size}
 }catch(e){return null}};
P.pageSource=function(PL,doc,page){
 const cont=page.node.Contents(),parts=[];
 if(cont&&cont.size&&cont.lookup){for(let i=0;i<cont.size();i++)parts.push(cont.lookup(i))}else if(cont)parts.push(cont);
 return parts.map(s=>latin1(s.getUnencodedContents?s.getUnencodedContents():PL.decodePDFRawStream(s).decode())).join('\n')};
P.open=function(PL,doc,page){const src=P.pageSource(PL,doc,page);return{PL,doc,page,src,ops:CS.scan(src),used:new Set(),edits:[],ins:new Map(),late:[],inplace:0}};
/* job: {items:[{x,y}] user-space origins of the original text pieces, text} -> {mode:'tj',hex}|{mode:'vec'}|{mode:'none'} */
P.planText=function(cx,job,tjOk){
 const ms=[];for(const it of job.items){const m=CS.matchText(cx.ops,it.x,it.y,cx.used);if(!m||!m.bt||ms.includes(m))return{mode:'none'};ms.push(m)}
 if(!ms.length)return{mode:'none'};ms.forEach(m=>cx.used.add(m));
 const codec=tjOk&&!ms.some(m=>m.chainNext)&&P.codec(cx.PL,cx.doc,cx.page,ms[0].font),hex=codec&&codec.encode(job.text);
 return hex?{mode:'tj',ms,hex}:{mode:'vec',ms}};
/* str = absolute user-space path operators (vec mode) */
P.applyText=function(cx,plan,str){
 const ms=plan.ms,rm=m=>cx.edits.push({s:m.op.s,e:m.op.e,rep:m.chainNext?`3 Tr ${cx.src.slice(m.op.s,m.op.e)} ${m.tr} Tr`:''});
 if(plan.mode==='tj'){cx.edits.push({s:ms[0].op.s,e:ms[0].op.e,rep:`<${plan.hex}> Tj`});ms.slice(1).forEach(rm);return true}
 if(plan.mode==='vec'&&str!=null){ms.forEach(rm);if(str){const m0=ms[0],k=m0.bt.e,a=cx.ins.get(k)||{ctm:m0.ctm,s:[]};a.s.push(str);cx.ins.set(k,a)}return true}
 return false};
P.finish=function(cx,items){
 const{PL,doc,page,src,ops,used}=cx,edits=cx.edits,late=[];
 for(const[k,a]of cx.ins)edits.push({s:k,e:k,rep:'\nq '+CS.inv(a.ctm).map(f4).join(' ')+' cm\n'+a.s.join('\n')+'\nQ\n'});
 for(const it of items){
  const m=CS.match(ops,it.k,it.rb,used);
  if(m){used.add(m.n);
   if(m.op.full&&!m.clip){edits.push({s:m.op.s,e:m.op.e,rep:'\n'+it.build(CS.mul(it.M,CS.inv(m.ctm)))+'\n'});cx.inplace++;continue}
   edits.push({s:m.op.s,e:m.op.e,rep:m.op.full?'':(m.k==='p'?'n':'')});late.push({it,cover:''})}
  else late.push({it,cover:it.cover||''})}
 if(!edits.length&&!late.length)return;
 const ref=doc.context.register(doc.context.flateStream(toBytes('q\n'+CS.edit(src,edits)+'\nQ\n')));
 page.node.set(PL.PDFName.of('Contents'),ref);
 if(late.length)page.node.addContentStream(doc.context.register(doc.context.flateStream(toBytes(late.map(l=>l.cover+l.it.build(l.it.M)).join('\n')))))};
/* items: [{k:'p'|'i', rb:{x0,y0,x1,y1} user-space bbox of the original, M: local->user matrix, build(cm)->string, cover:'q ..Q' string|''}] */
P.rebuild=function(PL,doc,page,items){if(!items.length)return{inplace:0,late:0};const cx=P.open(PL,doc,page);P.finish(cx,items);return{inplace:cx.inplace}};
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
