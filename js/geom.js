/* Shape geometry helpers (pure). Paths are arrays: ['M',x,y] ['L',x,y] ['C',x1,y1,x2,y2,x3,y3] ['Z'] */
(function(root){
const G={};
G.bbox=cmds=>{let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
 for(const c of cmds)for(let i=1;i<c.length;i+=2){x0=Math.min(x0,c[i]);x1=Math.max(x1,c[i]);y0=Math.min(y0,c[i+1]);y1=Math.max(y1,c[i+1])}
 return{x0,y0,x1,y1}};
/* classify: rect (axis aligned) / ellipse (4 beziers) / path */
G.classify=function(cmds){
 const b=G.bbox(cmds),w=b.x1-b.x0,h=b.y1-b.y0,e=Math.max(.6,Math.min(w,h)*.02);
 const segs=cmds.filter(c=>c[0]!=='Z');
 const L=segs.filter(c=>c[0]==='L').length,C=segs.filter(c=>c[0]==='C').length;
 if(C===0&&(L===3||L===4)){
  const p=segs.map(c=>[c[1],c[2]]);if(p.length===5&&Math.hypot(p[0][0]-p[4][0],p[0][1]-p[4][1])<e)p.pop();
  if(p.length===4){let ok=true;for(let i=0;i<4;i++){const a=p[i],q=p[(i+1)%4];if(Math.abs(a[0]-q[0])>e&&Math.abs(a[1]-q[1])>e)ok=false}
   if(ok)return{type:'rect'}}}
 if(C===4&&L===0){const mid=[(b.x0+b.x1)/2,(b.y0+b.y1)/2];let ok=true;
  for(const c of segs.filter(c=>c[0]==='C')){const x=c[5],y=c[6];
   const onMid=Math.abs(x-mid[0])<w*.06||Math.abs(y-mid[1])<h*.06;const onEdge=Math.abs(x-b.x0)<w*.06||Math.abs(x-b.x1)<w*.06||Math.abs(y-b.y0)<h*.06||Math.abs(y-b.y1)<h*.06;
   if(!(onMid&&onEdge))ok=false}
  if(ok)return{type:'ellipse'}}
 if(C>=4&&L>=2&&L<=4&&C<=8)return{type:'rrect'};
 return{type:'path'}};
/* normalised SVG path (coords relative to bbox origin) */
G.toSvg=(cmds,ox,oy)=>cmds.map(c=>{if(c[0]==='Z')return'Z';const o=[];for(let i=1;i<c.length;i+=2)o.push(+(c[i]-ox).toFixed(2),+(c[i+1]-oy).toFixed(2));return c[0]+o.join(' ')}).join('');
/* local (original-px, y down, from shape origin) -> page px, for an element with centre cx,cy, size w,h, original size sw,sh, css rotation rot */
const mul=(a,b)=>[a[0]*b[0]+a[1]*b[2],a[0]*b[1]+a[1]*b[3],a[2]*b[0]+a[3]*b[2],a[2]*b[1]+a[3]*b[3],a[4]*b[0]+a[5]*b[2]+b[4],a[4]*b[1]+a[5]*b[3]+b[5]];
G.mul=mul;
G.localToPx=o=>{const t=(o.rot||0)*Math.PI/180,c=Math.cos(t),s=Math.sin(t),su=o.w/o.sw,sv=o.h/o.sh;
 return[su*c,su*s,-sv*s,sv*c,o.cx-o.w/2*c+o.h/2*s,o.cy-o.w/2*s-o.h/2*c]};
/* Pu: page px -> PDF user space affine */
G.exportMatrix=(o,Pu)=>mul(G.localToPx(o),Pu);
G.apply=(m,u,v)=>[m[0]*u+m[2]*v+m[4],m[1]*u+m[3]*v+m[5]];
/* quadratic -> cubic helper for glyph outlines */
G.quad=(x0,y0,cx,cy,x,y)=>[x0+2/3*(cx-x0),y0+2/3*(cy-y0),x+2/3*(cx-x),y+2/3*(cy-y),x,y];
/* flood-fill region of similar colour from (sx,sy). returns {x0,y0,x1,y1,area,color,mask} */
G.flood=function(d,w,h,sx,sy,tol){
 const i0=(sy*w+sx)*4,R=d[i0],Gc=d[i0+1],B=d[i0+2],seen=new Uint8Array(w*h),st=[sy*w+sx];seen[sy*w+sx]=1;
 let x0=sx,x1=sx,y0=sy,y1=sy,area=0;
 while(st.length){const p=st.pop(),x=p%w,y=(p/w)|0;area++;if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;
  for(const q of[x>0?p-1:-1,x<w-1?p+1:-1,y>0?p-w:-1,y<h-1?p+w:-1]){if(q<0||seen[q])continue;const o=q*4;
   if(Math.abs(d[o]-R)+Math.abs(d[o+1]-Gc)+Math.abs(d[o+2]-B)<=tol){seen[q]=1;st.push(q)}}}
 return{x0,y0,x1:x1+1,y1:y1+1,area,color:[R,Gc,B],mask:seen}};
/* classify a flood region: rect / ellipse by fill ratio of the (hole-filled) silhouette */
G.floodType=function(f,w){
 const bw=f.x1-f.x0,bh=f.y1-f.y0;let sil=0;
 for(let y=f.y0;y<f.y1;y++){let a=-1,b=-1;for(let x=f.x0;x<f.x1;x++)if(f.mask[y*w+x]){if(a<0)a=x;b=x}if(a>=0)sil+=b-a+1}
 const r=sil/(bw*bh);return r>.95?'rect':(r>.72&&r<.84?'ellipse':(r>.85?'rrect':'blob'))};
if(typeof module!=='undefined')module.exports=G;else root.G=G;
})(typeof self!=='undefined'?self:this);
