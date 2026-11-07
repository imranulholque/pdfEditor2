/* Bengali helpers: repair text that PDFs store in *visual glyph order*, and score how well a
   candidate rendering matches the original pixels. Pure functions (testable in Node). */
(function(root){
const BN={};
const isC=c=>(c>=0x995&&c<=0x9B9)||c===0x9CE||c===0x9DC||c===0x9DD||c===0x9DF||c===0x9F0||c===0x9F1;
const VIR=0x9CD,NUK=0x9BC,RA=0x9B0,E=0x9C7,AA=0x9BE,AU=0x9D7,O=0x9CB,OU=0x9CC;
const PRE=new Set([0x9BF,0x9C7,0x9C8]);
const POST=new Set([0x9BE,0x9C0,0x9C1,0x9C2,0x9C3,0x9C4,0x9D7,0x982,0x983,0x981]);
const ZW=new Set([0x200C,0x200D]);
BN.hasBn=s=>/[\u0980-\u09FF]/.test(s);
const cp=s=>Array.from(s,ch=>ch.codePointAt(0));
const str=a=>String.fromCodePoint(...a);
/* does the text look like it is stored in visual (glyph) order? */
BN.visualEvidence=function(s){
 const a=cp(s);let pre=0,reph=0;
 for(let i=0;i<a.length;i++){
  if(PRE.has(a[i])){const p=a[i-1];if(!(p!==undefined&&(isC(p)||p===NUK)))pre++}
  if(a[i]===RA&&a[i+1]===VIR&&!isC(a[i+2])&&!ZW.has(a[i+2]))reph++;
 }
 return{pre,reph};
};
/* visual order -> logical (Unicode) order. all=true treats every pre-vowel as pre-base. */
BN.toLogical=function(s,all){
 const a=cp(s),n=a.length,out=[];let i=0;
 const cluster=j=>{if(!isC(a[j]))return j;let k=j+1;if(a[k]===NUK)k++;
  while(a[k]===VIR&&isC(a[k+1])){k+=2;if(a[k]===NUK)k++}return k};
 while(i<n){
  const pre=[];
  while(i<n&&PRE.has(a[i])&&(all||!(isC(a[i-1])||a[i-1]===NUK))){pre.push(a[i]);i++}
  if(!isC(a[i])){
   if(pre.length)out.push(...pre);
   else if(i<n){out.push(a[i]);i++}
   continue}
  let j=cluster(i);const post=[];
  while(j<n&&POST.has(a[j])){post.push(a[j]);j++}
  let reph=false;
  if(a[j]===RA&&a[j+1]===VIR&&!isC(a[j+2])&&!ZW.has(a[j+2])){reph=true;j+=2;while(j<n&&POST.has(a[j])){post.push(a[j]);j++}}
  const cl=a.slice(i,cluster(i));
  if(reph)out.push(RA,VIR);
  out.push(...cl);
  let tail=post.slice();
  if(pre.length){
   const last=pre[pre.length-1];
   if(last===E&&tail[0]===AA){tail=[O,...tail.slice(1)];pre.pop()}
   else if(last===E&&tail[0]===AU){tail=[OU,...tail.slice(1)];pre.pop()}
   out.push(...pre.reverse())}
  out.push(...tail);i=j;
 }
 return str(out);
};
/* candidate texts, best guess first */
BN.candidates=function(s){
 if(!BN.hasBn(s))return[s];
 const ev=BN.visualEvidence(s),full=BN.toLogical(s,true),part=BN.toLogical(s,false),c=[];
 const push=t=>{if(!c.includes(t))c.push(t)};
 if(ev.pre||ev.reph){push(full);push(part);push(s)}else{push(s);push(part);push(full)}
 return c;
};
/* ---- pixel scoring ---- */
BN.inkMask=function(d,w,h,bg,thr){const m=new Uint8Array(w*h);
 for(let p=0;p<w*h;p++){const q=p*4;if(Math.abs(d[q]-bg[0])+Math.abs(d[q+1]-bg[1])+Math.abs(d[q+2]-bg[2])>thr)m[p]=1}return m};
BN.dilate=function(m,w,h,r){let cur=m;for(let t=0;t<r;t++){const o=cur.slice();
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const p=y*w+x;if(cur[p]){if(x>0)o[p-1]=1;if(x<w-1)o[p+1]=1;if(y>0)o[p-w]=1;if(y<h-1)o[p+w]=1}}cur=o}return cur};
BN.f1=function(A,B,w,h,r){const dA=BN.dilate(A,w,h,r||1),dB=BN.dilate(B,w,h,r||1);let a=0,b=0,ia=0,ib=0;
 for(let p=0;p<A.length;p++){if(A[p]){a++;if(dB[p])ia++}if(B[p]){b++;if(dA[p])ib++}}
 if(!a||!b)return 0;const pr=ib/b,rc=ia/a;return pr+rc?2*pr*rc/(pr+rc):0};
if(typeof module!=='undefined')module.exports=BN;else root.BN=BN;
})(typeof self!=='undefined'?self:this);
