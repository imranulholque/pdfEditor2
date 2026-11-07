const BN=require('../js/bn.js'),assert=require('assert');
// visual -> logical
assert.strictEqual(BN.toLogical('ৈসকত',true),'সৈকত');            // pre-vowel moved after consonant
assert.strictEqual(BN.toLogical('এক্সেপ্র',true),'এক্সপ্রে');
assert.strictEqual(BN.toLogical('েকা',true),'কো');                // e + aa -> o
assert.strictEqual(BN.toLogical('েকৗ',true),'কৌ');
assert.strictEqual(BN.toLogical('ি\u0995\u09CD\u09B7',true),'ক্ষি'); // pre-vowel over a conjunct
assert.strictEqual(BN.toLogical('কমর্',true),'কর্ম');            // reph glyph after base -> before
assert.strictEqual(BN.toLogical('িকর্',true),'র্কি');            // reph + pre-vowel
// already logical text must be untouched
for(const t of ['কিছু','সৈকত এক্সপ্রেস','কর্ম','বাংলাদেশ','চট্টগ্রাम'.replace('म','ম'),'২২-১০-২০২৬','Cox\'s Bazar'])
 assert.strictEqual(BN.candidates(t)[0],t,t);
// visual text is detected and ranked first
assert.strictEqual(BN.candidates('ৈসকত এক্সেপ্র')[0],BN.toLogical('ৈসকত এক্সেপ্র',true));
// word-level: "ছিলেন" stored visually
assert.strictEqual(BN.toLogical('িছেলন',true),'ছিলেন');
// pixel scorer
const w=20,h=10,A=new Uint8Array(w*h),B=new Uint8Array(w*h);
for(let x=3;x<15;x++){A[5*w+x]=1;B[5*w+x]=1}
assert(BN.f1(A,B,w,h)>.99);
const C=new Uint8Array(w*h);for(let y=0;y<10;y++)C[y*w+18]=1;
assert(BN.f1(A,C,w,h)<.2);
console.log('bn ok');
