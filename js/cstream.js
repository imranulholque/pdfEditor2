/* Minimal PDF content-stream interpreter: finds fill/stroke/image paint operations with their
   bounding boxes (PDF user space) and can neutralise chosen ones, so a shape/picture can truly be
   REMOVED from the saved PDF (instead of hidden under a patch). Pure; works on latin1 strings. */
(function(root){
const CS={};
const WS=/[\0\t\n\f\r ]/,DL=/[()<>\[\]{}\/%]/;
CS.tokenize=function(s){
 const T=[];let i=0;const n=s.length;
 const readStr=()=>{let d=1,j=i+1;while(j<n&&d>0){const c=s[j];if(c==='\\')j++;else if(c==='(')d++;else if(c===')')d--;j++}return j};
 const one=()=>{ // returns token end for a value, assumes s[i] begins it
  const c=s[i];
  if(c==='('){return{t:'s',e:readStr()}}
  if(c==='<'&&s[i+1]==='<'){let d=1,j=i+2;while(j<n&&d>0){if(s[j]==='<'&&s[j+1]==='<'){d++;j+=2}else if(s[j]==='>'&&s[j+1]==='>'){d--;j+=2}else if(s[j]==='('){const sv=i;i=j;j=readStr();i=sv}else j++}return{t:'d',e:j}}
  if(c==='<'){const j=s.indexOf('>',i);return{t:'s',e:j<0?n:j+1}}
  if(c==='['){let d=1,j=i+1;while(j<n&&d>0){if(s[j]==='[')d++;else if(s[j]===']')d--;else if(s[j]==='('){const sv=i;i=j;j=readStr()-1;i=sv}j++}return{t:'a',e:j}}
  if(c==='/'){let j=i+1;while(j<n&&!WS.test(s[j])&&!DL.test(s[j]))j++;return{t:'n',e:j}}
  let j=i;while(j<n&&!WS.test(s[j])&&!DL.test(s[j]))j++;if(j===i)j++;
  const w=s.slice(i,j);return{t:/^[+-]?(\d+\.?\d*|\.\d+)$/.test(w)?'#':'o',e:j}};
 while(i<n){
  const c=s[i];
  if(WS.test(c)){i++;continue}
  if(c==='%'){while(i<n&&s[i]!=='\n'&&s[i]!=='\r')i++;continue}
  const st=i,r=one();i=r.e;let tok={t:r.t,v:s.slice(st,i),s:st,e:i};
  if(tok.t==='o'&&tok.v==='BI'){ // inline image: skip to EI
   const idm=/[\0\t\n\f\r ]ID[\0\t\n\f\r ]/g;idm.lastIndex=i;const m=idm.exec(s);let j=m?m.index+m[0].length:n;
   const em=/[\0\t\n\f\r ]EI(?=[\0\t\n\f\r ]|$)/g;em.lastIndex=j;const e=em.exec(s);i=e?e.index+e[0].length:n;tok={t:'o',v:'BI',s:st,e:i,inline:true}}
  T.push(tok)}
 return T};
const mul=(a,b)=>[a[0]*b[0]+a[1]*b[2],a[0]*b[1]+a[1]*b[3],a[2]*b[0]+a[3]*b[2],a[2]*b[1]+a[3]*b[3],a[4]*b[0]+a[5]*b[2]+b[4],a[4]*b[1]+a[5]*b[3]+b[5]];
CS.mul=mul;
/* returns [{k:'p'|'i', b:{x0,y0,x1,y1} (user space), color, op:{s,e} replace-span, n:ordinal}] */
CS.scan=function(s){
 const T=CS.tokenize(s),out=[];let ctm=[1,0,0,1,0,0],st=[],pb=null,fill=null,strokeC=null,lw=1,clip=false,ps=-1,pend=false;
 const pt=(x,y)=>{const X=ctm[0]*x+ctm[2]*y+ctm[4],Y=ctm[1]*x+ctm[3]*y+ctm[5];
  pb=pb?{x0:Math.min(pb.x0,X),y0:Math.min(pb.y0,Y),x1:Math.max(pb.x1,X),y1:Math.max(pb.y1,Y)}:{x0:X,y0:Y,x1:X,y1:Y}};
 const num=a=>a.map(t=>+t.v);
 const col=(a,sp)=>{const v=num(a.filter(t=>t.t==='#'));if(v.length===1)return[v[0],v[0],v[0]].map(x=>Math.round(x*255));
  if(v.length===3)return v.map(x=>Math.round(x*255));if(v.length===4)return[0,1,2].map(i=>Math.round(255*(1-v[i])*(1-v[3])));return null};
 let args=[],depthBT=false,ord=0;
 for(const tk of T){
  if(tk.t!=='o'){args.push(tk);continue}
  const o=tk.v,a=args;args=[];
  const first=a.length?a[0].s:tk.s;
  switch(o){
   case'q':st.push([ctm,fill,strokeC,lw,clip]);break;
   case'Q':{const x=st.pop();if(x){ctm=x[0];fill=x[1];strokeC=x[2];lw=x[3];clip=x[4]}break}
   case'cm':if(a.length===6)ctm=mul(num(a),ctm);break;
   case'w':lw=+a[0].v;break;
   case'g':case'rg':case'k':fill=col(a);break;
   case'G':case'RG':case'K':strokeC=col(a);break;
   case'sc':case'scn':fill=a.some(t=>t.t==='n')?null:col(a);break;
   case'SC':case'SCN':strokeC=a.some(t=>t.t==='n')?null:col(a);break;
   case'm':case'l':if(ps<0)ps=first;pt(+a[0].v,+a[1].v);break;
   case'c':if(ps<0)ps=first;pt(+a[0].v,+a[1].v);pt(+a[2].v,+a[3].v);pt(+a[4].v,+a[5].v);break;
   case'v':case'y':if(ps<0)ps=first;pt(+a[0].v,+a[1].v);pt(+a[2].v,+a[3].v);break;
   case're':{if(ps<0)ps=first;const x=+a[0].v,y=+a[1].v,w=+a[2].v,h=+a[3].v;pt(x,y);pt(x+w,y+h);pt(x+w,y);pt(x,y+h);break}
   case'f':case'F':case'f*':case'B':case'B*':case'b':case'b*':case'S':case's':{
    if(pb){const f=/^[fFBb]/.test(o),sk=/^[BbSs]/.test(o);let b={...pb};
     if(sk){const hw=lw*Math.hypot(ctm[0],ctm[1])/2;b={x0:b.x0-hw,y0:b.y0-hw,x1:b.x1+hw,y1:b.y1+hw}}
     out.push({k:'p',b,fill:f?fill:null,stroke:sk?strokeC:null,lw:lw*Math.hypot(ctm[0],ctm[1]),eo:/\*/.test(o),op:{s:ps>=0?ps:tk.s,e:tk.e,full:ps>=0},ctm:ctm.slice(),clip,n:ord++})}
    pb=null;ps=-1;break}
   case'W':case'W*':clip=true;break;
   case'n':pb=null;ps=-1;break;
   case'Do':out.push({k:'i',b:{x0:Math.min(ctm[4],ctm[4]+ctm[0],ctm[4]+ctm[2],ctm[4]+ctm[0]+ctm[2]),y0:Math.min(ctm[5],ctm[5]+ctm[1],ctm[5]+ctm[3],ctm[5]+ctm[1]+ctm[3]),
     x1:Math.max(ctm[4],ctm[4]+ctm[0],ctm[4]+ctm[2],ctm[4]+ctm[0]+ctm[2]),y1:Math.max(ctm[5],ctm[5]+ctm[1],ctm[5]+ctm[3],ctm[5]+ctm[1]+ctm[3])},
     op:{s:first,e:tk.e,full:true},name:a.length?a[0].v:'',ctm:ctm.slice(),clip,n:ord++});break;
   case'BI':out.push({k:'i',b:{x0:ctm[4],y0:ctm[5],x1:ctm[4]+ctm[0],y1:ctm[5]+ctm[3]},op:{s:tk.s,e:tk.e,full:true},inline:true,ctm:ctm.slice(),clip,n:ord++});break;
  }}
 return out};
const iou=(a,b)=>{const x0=Math.max(a.x0,b.x0),y0=Math.max(a.y0,b.y0),x1=Math.min(a.x1,b.x1),y1=Math.min(a.y1,b.y1);
 if(x1<=x0||y1<=y0){const aw=a.x1-a.x0,ah=a.y1-a.y0;return(aw<.01||ah<.01)&&Math.abs(a.x0-b.x0)<1&&Math.abs(a.y0-b.y0)<1?.5:0}
 const i=(x1-x0)*(y1-y0),u=(a.x1-a.x0)*(a.y1-a.y0)+(b.x1-b.x0)*(b.y1-b.y0)-i;return u>0?i/u:0};
/* find the scanned op that best matches a bbox (user space) of kind k; used = Set of already matched ordinals */
CS.match=function(list,k,b,used){let best=null,bs=.8;
 for(const o of list){if(o.k!==k||(used&&used.has(o.n)))continue;const s=iou(o.b,b);if(s>bs){bs=s;best=o}}return best};
/* neutralise the given ops: paint ops become 'n', images are cut out */
/* edits: [{s,e,rep}] non-overlapping; applied from the end */
CS.edit=function(s,edits){for(const x of[...edits].sort((a,b)=>b.s-a.s))s=s.slice(0,x.s)+x.rep+s.slice(x.e);return s};
CS.remove=function(s,ops){return CS.edit(s,ops.map(o=>({s:o.op.s,e:o.op.e,rep:o.op.full?'':(o.k==='p'?'n':'')})))};
CS.inv=m=>{const d=m[0]*m[3]-m[1]*m[2];return[m[3]/d,-m[1]/d,-m[2]/d,m[0]/d,(m[2]*m[5]-m[3]*m[4])/d,(m[1]*m[4]-m[0]*m[5])/d]};
if(typeof module!=='undefined')module.exports=CS;else root.CS=CS;
})(typeof self!=='undefined'?self:this);
