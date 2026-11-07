global.CS=require('../js/cstream.js');const G=require('../js/geom.js'),PO=require('../js/pdfops.js'),assert=require('assert');
const PL=(()=>{try{return require('pdf-lib')}catch(e){return require('/opt/npm-tools/node_modules/pdf-lib')}})();
(async()=>{
 for(const n of['pushGraphicsState','decodePDFRawStream','PDFName','PDFArray','rgb'])assert(PL[n],n);
 const doc=await PL.PDFDocument.create(),pg=doc.addPage([400,300]);
 // build page content manually: red rect (shape), text, blue rect
 const content='q 1 0 0 rg 50 50 100 40 re f Q\nBT /F1 12 Tf 60 60 Td (Hello) Tj ET\nq 0 0 1 rg 200 100 50 50 re f Q';
 const st=doc.context.register(doc.context.flateStream(Buffer.from(content,'latin1')));pg.node.set(PL.PDFName.of('Contents'),st);
 assert(PO.pageSource(PL,doc,pg).includes('Hello'));
 // move red rect to x=300,y=200 (user space) same size: M maps local(0..100,0..40 y-down) -> user
 const S={w:100,h:40,cmds:[['M',0,0],['L',100,0],['L',100,40],['L',0,40],['Z']],eo:false};
 const Pu=[1,0,0,-1,0,300];                       // px(=pt, y down) -> user, page height 300
 const M=G.exportMatrix({cx:350,cy:80,w:100,h:40,sw:100,sh:40,rot:0},Pu);   // new centre px (350,80) => user y 220
 const rb={x0:50,y0:50,x1:150,y1:90};
 const r=PO.rebuild(PL,doc,pg,[{k:'p',rb,M,build:cm=>PO.shapeStr(S,{fill:'#00ff00',stroke:'',lw:0},{w:100,h:40},cm,''),cover:''}]);
 assert.strictEqual(r.inplace,1);
 PO.append(PL,doc,pg,'0 0 0 rg 10 10 5 5 re f');
 pg.drawRectangle({x:1,y:1,width:5,height:5});   // pdf-lib's own drawing afterwards must still work
 const bytes=await doc.save();
 const d2=await PL.PDFDocument.load(bytes),out=PO.pageSource(PL,d2,d2.getPage(0));
 console.log(out);
 assert(!out.includes('50 50 100 40 re'));assert(out.includes('(Hello) Tj'));assert(out.includes('0 1 0 rg'));
 assert(out.indexOf('0 1 0 rg')<out.indexOf('Hello'),'z-order kept: shape before text');
 // the replacement matrix, combined with original ctm (identity), maps local (0,0) to user (300,220+40=260)
 const cmS=/q ([^\n]*) cm\n0 0 m/.exec(out)[1].split(' ').map(Number);const p=G.apply(cmS,0,0);
 assert(Math.abs(p[0]-300)<1e-3&&Math.abs(p[1]-(300-60))<1e-3,JSON.stringify(p));
 console.log('pdfops ok');
})().catch(e=>{console.error(e);process.exit(1)});
