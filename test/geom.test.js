const G=require('../js/geom.js'),CS=require('../js/cstream.js'),assert=require('assert');
// classify
const R=[['M',10,10],['L',50,10],['L',50,40],['L',10,40],['Z']];
assert.strictEqual(G.classify(R).type,'rect');
const k=.5523,cx=50,cy=50,rx=30,ry=20;
const E=[['M',cx+rx,cy],['C',cx+rx,cy+ry*k,cx+rx*k,cy+ry,cx,cy+ry],['C',cx-rx*k,cy+ry,cx-rx,cy+ry*k,cx-rx,cy],['C',cx-rx,cy-ry*k,cx-rx*k,cy-ry,cx,cy-ry],['C',cx+rx*k,cy-ry,cx+rx,cy-ry*k,cx+rx,cy],['Z']];
assert.strictEqual(G.classify(E).type,'ellipse');
assert.strictEqual(G.classify([['M',0,0],['L',50,0],['L',25,40],['Z']]).type,'path');
// export matrix: unrotated point (0,0) top-left of shape at page px (100,200), size 40x20, page H=800pt k=1/1.5
const kk=1/1.5,Pu=[kk,0,0,-kk,0,800],m=G.exportMatrix({cx:120,cy:210,w:40,h:20,sw:40,sh:20,rot:0},Pu);
let p=G.apply(m,0,0);assert(Math.abs(p[0]-100*kk)<1e-6&&Math.abs(p[1]-(800-200*kk))<1e-6);
p=G.apply(m,40,20);assert(Math.abs(p[0]-140*kk)<1e-6&&Math.abs(p[1]-(800-220*kk))<1e-6);
// rotation 90deg clockwise about centre: top-left goes to top-right
const m2=G.exportMatrix({cx:120,cy:210,w:40,h:20,sw:40,sh:20,rot:90},Pu);
p=G.apply(m2,0,0);assert(Math.abs(p[0]-130*kk)<1e-6&&Math.abs(p[1]-(800-190*kk))<1e-6,JSON.stringify(p));
// resize scaling
const m3=G.exportMatrix({cx:120,cy:210,w:80,h:20,sw:40,sh:20,rot:0},Pu);
p=G.apply(m3,40,0);assert(Math.abs(p[0]-160*kk)<1e-6);
// flood fill
const w=30,h=20,d=new Uint8ClampedArray(w*h*4).fill(255);
for(let y=5;y<15;y++)for(let x=5;x<25;x++){const o=(y*w+x)*4;d[o]=200;d[o+1]=30;d[o+2]=30}
for(let y=8;y<10;y++)for(let x=8;x<12;x++){const o=(y*w+x)*4;d[o]=d[o+1]=d[o+2]=0} // text hole
const f=G.flood(d,w,h,6,6,30);assert.deepStrictEqual([f.x0,f.y0,f.x1,f.y1],[5,5,25,15]);assert.strictEqual(G.floodType(f,w),'rect');
// content stream
const src='q 1 0 0 1 0 0 cm 1 0 0 rg 100 100 200 50 re f Q\nBT /F1 12 Tf 10 10 Td (Hi \\) there) Tj ET\nq 0 0 1 RG 4 w 10 10 m 60 10 l S Q\nq 50 0 0 40 300 400 cm /Im1 Do Q';
const sc=CS.scan(src);assert.strictEqual(sc.length,3);
assert.deepStrictEqual(sc[0].b,{x0:100,y0:100,x1:300,y1:150});assert.deepStrictEqual(sc[0].fill,[255,0,0]);
assert.strictEqual(sc[1].b.y0,8);assert.strictEqual(sc[2].k,'i');assert.deepStrictEqual(sc[2].b,{x0:300,y0:400,x1:350,y1:440});
const mt=CS.match(sc,'p',{x0:100.2,y0:99.8,x1:300,y1:150},new Set());assert.strictEqual(mt.n,0);
const out=CS.remove(src,[sc[0],sc[2]]);assert(!out.includes('100 100 200 50 re'));assert(out.includes('1 0 0 rg'));assert(!out.includes('Im1'));assert(out.includes('(Hi \\) there) Tj'));
// in-place replacement: cm = Mdes x inv(ctm) must give Mdes when combined with ctm
const src2='q 2 0 0 2 10 20 cm 1 0 0 rg 5 5 30 10 re f Q';const sc2=CS.scan(src2)[0];
assert(sc2.op.full&&src2.slice(sc2.op.s,sc2.op.e)==='5 5 30 10 re f',src2.slice(sc2.op.s,sc2.op.e));
const Md=[1,0,0,1,100,100],cm=CS.mul(Md,CS.inv(sc2.ctm)),tot=CS.mul(cm,sc2.ctm);
tot.forEach((v,i)=>assert(Math.abs(v-Md[i])<1e-9));
assert.strictEqual(sc2.clip,false);
assert.strictEqual(CS.scan('q 0 0 10 10 re W n 1 0 0 rg 0 0 5 5 re f Q')[0].clip,true);
console.log('geom/cstream ok');
