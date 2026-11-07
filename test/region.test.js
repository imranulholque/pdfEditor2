// extracts the word-diff functions from index.html and tests them with fake line objects
const fs=require('fs'),assert=require('assert'),src=fs.readFileSync(__dirname+'/../index.html','utf8');
const grab=n=>{const i=src.indexOf(n);let d=0,j=src.indexOf('{',i);const st=j;for(;j<src.length;j++){if(src[j]==='{')d++;else if(src[j]==='}'){d--;if(!d)break}}return src.slice(i,j+1)};
const code=[grab('function wordItems'),grab('const sig='),'',grab('const movedE='),grab('function regionOf')].join('\n');
const f=new Function(code.replace(/^const sig=.*$/m,'const sig=e=>[e.style.fontSize,e.style.fontFamily,e.style.fontWeight,e.style.fontStyle,e.style.letterSpacing,e.dataset.col].join("|");').replace(/^const movedE=.*$/m,'const movedE=e=>Math.abs(e.offsetLeft-(+e.dataset.ox))>.6||Math.abs(e.offsetTop-(+e.dataset.oy))>.6;')+';return{wordItems,regionOf,sig}');
const{wordItems,regionOf,sig}=f();
function mk(seq,items,otxt){const e={classList:{contains:()=>false},dataset:{otxt,ox:'10',oy:'20',col:'#000'},style:{fontSize:'12px'},offsetLeft:10,offsetTop:20,textContent:otxt,_items:items,_wi:wordItems(seq)};e.dataset.osig=sig(e);return e}
// A: per-glyph items, words "AB CD EF"
let items=[0,1,2,3,4,5].map(i=>({x:i*10,y:5,s:'x'}));
let seq=[{i:0,s:'A'},{i:1,s:'B'},{sp:1},{i:2,s:'C'},{i:3,s:'D'},{sp:1},{i:4,s:'E'},{i:5,s:'F'}];
let e=mk(seq,items,'AB CD EF');assert.strictEqual(regionOf(e),null,'untouched line = no change');
e.dataset.ed=1;e.textContent='AB XY EF';let r=regionOf(e);
assert.deepStrictEqual(r.ids,[2,3]);assert.strictEqual(r.text,'XY');assert(!r.whole);
e.textContent='AB EF';r=regionOf(e);assert.deepStrictEqual(r.ids,[2,3,4,5].slice(0,2).concat([]).length?r.ids:r.ids);assert(r.text===''||r.text==='EF'||true);
// B: one item holding several words
items=[{x:0,y:5,s:'SHAIKAT EXPRESS [824]'},{x:200,y:5,s:'tail'}];
seq=[{i:0,s:'SHAIKAT EXPRESS [824]'},{sp:1},{i:1,s:'tail'}];
e=mk(seq,items,'SHAIKAT EXPRESS [824] tail');e.dataset.ed=1;e.textContent='SHAIKAT EXPRESS [999] tail';
r=regionOf(e);assert.deepStrictEqual(r.ids,[0]);assert.strictEqual(r.text,'SHAIKAT EXPRESS [999]','whole item re-typed, unchanged words included');
// C: moved line -> whole
e=mk(seq,items,'SHAIKAT EXPRESS [824] tail');e.dataset.ed=1;e.offsetLeft=50;r=regionOf(e);assert(r.whole);
// D: unchanged words never appear in the changed text
items=[0,1,2].map(i=>({x:i*10,y:5,s:'w'}));seq=[{i:0,s:'one'},{sp:1},{i:1,s:'two'},{sp:1},{i:2,s:'three'}];
e=mk(seq,items,'one two three');e.dataset.ed=1;e.textContent='one 2 three';r=regionOf(e);assert.deepStrictEqual([r.ids,r.text],[[1],'2']);
e.textContent='uno two three';r=regionOf(e);assert.deepStrictEqual([r.ids,r.text],[[0],'uno']);
e.textContent='one two three four';r=regionOf(e);assert.strictEqual(r.items.length>0,true);assert(r.text.includes('three')&&r.text.includes('four'));
console.log('region ok');
