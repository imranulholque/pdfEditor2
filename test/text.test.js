global.CS=require('../js/cstream.js');const PO=require('../js/pdfops.js'),assert=require('assert'),fs=require('fs');
const PL=(()=>{try{return require('pdf-lib')}catch(e){return require('/opt/npm-tools/node_modules/pdf-lib')}})();
(async()=>{
 if(!fs.existsSync('/tmp/subset.pdf')){console.log('skip (run: python3 test/make_subset_pdf.py /tmp/subset.pdf)');return}
 const gid=JSON.parse(fs.readFileSync('/tmp/subset.pdf.json')),H=t=>[...t].map(c=>gid[c]).join('');
 const doc=await PL.PDFDocument.load(fs.readFileSync('/tmp/subset.pdf')),pg=doc.getPage(0),cx=PO.open(PL,doc,pg);
 const texts=cx.ops.filter(o=>o.k==='t');assert.strictEqual(texts.length,3);
 assert(texts[0].known&&Math.abs(texts[0].x-50)<1e-6&&Math.abs(texts[0].y-700)<1e-6&&texts[0].font==='F1');
 assert(texts[1].known&&!texts[2].known,'2nd Tj in same BT without reposition is chained/unknown');assert(texts[1].chainNext===true);
 // "Hello" -> "Held": alone in its text block, every letter exists in the subset -> original font, in place
 const plan=PO.planText(cx,{items:[{x:50,y:700}],text:'Held'},true);
 assert.strictEqual(plan.mode,'tj');assert.strictEqual(plan.hex,H('Held'));PO.applyText(cx,plan,null);
 // "World" is followed by a chained "2026" (no reposition) -> replacing it could shift 2026, so use the safe outline route
 const p2=PO.planText(cx,{items:[{x:50,y:650}],text:'Word'},true);assert.strictEqual(p2.mode,'vec');
 PO.applyText(cx,p2,'0 0 0 rg 10 10 m 20 20 l f');
 // a letter that is NOT in the subset (Z): cannot use the original font -> outline route
 const doc3=await PL.PDFDocument.load(fs.readFileSync('/tmp/subset.pdf')),pg3=doc3.getPage(0),cx3=PO.open(PL,doc3,pg3);
 const p4=PO.planText(cx3,{items:[{x:50,y:700}],text:'Z!'},true);assert.strictEqual(p4.mode,'vec');
 PO.finish(cx,[]);
 const out=PO.pageSource(PL,doc,pg);
 assert(out.includes('<'+H('Held')+'> Tj'));assert(!out.includes('<'+H('Hello')+'>'),'old text removed from the PDF');
 assert(out.includes('10 10 m 20 20 l f')&&out.includes('cm'));
 const d2=await PL.PDFDocument.load(await doc.save());assert.strictEqual(d2.getPageCount(),1);
 console.log('text ok');
})().catch(e=>{console.error(e);process.exit(1)});
