/* Learning memory + font cache (client side). Everything learned is persisted, so every PDF you open
   makes the next one faster and more accurate. */
(function(root){
const S={mem:{v:1,fonts:{},stats:{pdfs:0,runs:0,fixed:0,downloads:0}},bytes:{},reg:new Set(),ready:null};
/* Bengali (and Latin) families the editor may try, best-known first. css = optional custom CSS url */
S.CAT=[
 {f:'Noto Sans Bengali'},{f:'Hind Siliguri'},{f:'Noto Serif Bengali'},
 {f:'Kalpurush',css:'https://fonts.maateen.me/kalpurush/font.css'},
 {f:'SolaimanLipi',css:'https://fonts.maateen.me/solaiman-lipi/font.css'},
 {f:'Siyam Rupali',css:'https://fonts.maateen.me/siyam-rupali/font.css'},
 {f:'Nikosh',css:'https://fonts.maateen.me/nikosh/font.css'},
 {f:'Mukti',css:'https://fonts.maateen.me/mukti/font.css'},
 {f:'Adorsho Lipi',css:'https://fonts.maateen.me/adorsho-lipi/font.css'},
 {f:'Anek Bangla'},{f:'Baloo Da 2'},{f:'Tiro Bangla'},{f:'Atma'},{f:'Galada'},{f:'Mina'}];
S.LATIN={arial:'Arimo',helvetica:'Arimo',timesnewroman:'Tinos',times:'Tinos',couriernew:'Cousine',courier:'Cousine',calibri:'Carlito',cambria:'Caladea'};
const key=(f,w,i)=>f+'|'+w+'|'+(i?1:0);
const api=()=>root.api&&root.api.memGet?root.api:null;
S.load=function(){return S.ready||(S.ready=(async()=>{
 try{const m=api()?await api().memGet():JSON.parse(localStorage.getItem('pdfeditor.mem')||'null');if(m&&m.fonts)S.mem=Object.assign(S.mem,m)}catch(e){}
 try{if(api())for(const e of await api().fontList())await S.register(e)}catch(e){}
})())};
let tm=null;
S.save=function(){clearTimeout(tm);tm=setTimeout(()=>{try{api()?api().memSet(S.mem):localStorage.setItem('pdfeditor.mem',JSON.stringify(S.mem))}catch(e){}},400)};
S.register=async function(e){
 const k=key(e.family,e.weight,e.italic);if(S.reg.has(k))return true;
 try{const b=await api().fontRead(e.file);if(!b)return false;const u=new Uint8Array(b);S.bytes[k]=u;
  const ff=new FontFace(e.family,u.buffer.slice(0),{weight:String(e.weight),style:e.italic?'italic':'normal'});await ff.load();document.fonts.add(ff);S.reg.add(k);return true}catch(x){return false}};
S.has=f=>[...S.reg].some(k=>k.startsWith(f+'|'));
/* make sure a family is available; downloads once, then it lives in the cache forever */
S.ensure=async function(family,css){
 await S.load();if(S.has(family))return true;if(!api())return false;
 try{const r=await api().fontFetch(family,css||(S.CAT.find(c=>c.f===family)||{}).css);let ok=false;
  for(const e of r)if(await S.register(e))ok=true;if(ok){S.mem.stats.downloads++;S.save()}return ok}catch(e){return false}};
/* bytes of the best matching weight for vector export */
S.bytesFor=function(family,weight,italic){
 const ks=[...S.reg].filter(k=>k.startsWith(family+'|'));if(!ks.length)return null;
 let best=null,bd=1e9;for(const k of ks){const[,w,i]=k.split('|'),d=Math.abs(+w-weight)+(!!+i!==!!italic?300:0);if(d<bd){bd=d;best=k}}
 return{bytes:S.bytes[best],weight:+best.split('|')[1]}};
S.addUser=async function(file){
 const name=file.name.replace(/\.(ttf|otf)$/i,''),buf=await file.arrayBuffer(),bold=/bold/i.test(name),it=/italic|oblique/i.test(name);
 const fam=name.replace(/[-_ ]?(bold|regular|italic|oblique|bolditalic)$/ig,'').trim()||name,w=bold?700:400;
 const ent={family:fam,weight:w,italic:it,file:''};
 if(api())ent.file=await api().fontSave(fam,w,it,file.name,buf);
 const k=key(fam,w,it),ff=new FontFace(fam,buf.slice(0),{weight:String(w),style:it?'italic':'normal'});await ff.load();document.fonts.add(ff);S.reg.add(k);S.bytes[k]=new Uint8Array(buf);return fam};
/* what we learned about a PDF font (normalised name) */
S.recall=n=>S.mem.fonts[n]||null;
S.learn=function(n,o){if(!n)return;const c=S.mem.fonts[n]||{n:0};
 S.mem.fonts[n]=Object.assign(c,o,{n:c.n+1,t:Date.now()});S.save()};
S.bump=(k,v)=>{S.mem.stats[k]=(S.mem.stats[k]||0)+(v||1);S.save()};
if(typeof module!=='undefined')module.exports=S;else root.ST=S;
})(typeof self!=='undefined'?self:this);
