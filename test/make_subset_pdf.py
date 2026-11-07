# builds a PDF whose text uses a SUBSET Type0/Identity-H TrueType font with ToUnicode (what Chrome/Word emit)
import io,sys
from fontTools import subset
from fontTools.ttLib import TTFont
src='/usr/share/fonts/truetype/freefont/FreeSans.ttf'
text='Hello World 2026'
opts=subset.Options();opts.layout_features=[];opts.glyph_names=False;opts.notdef_outline=True;opts.name_IDs=[]
f=TTFont(src);sub=subset.Subsetter(opts);sub.populate(text=text);sub.subset(f)
cm=TTFont(src).getBestCmap();order=f.getGlyphOrder()
buf=io.BytesIO();f.save(buf);fontdata=buf.getvalue()
gid={ch:order.index(cm[ord(ch)]) for ch in set(text)}
def hexs(s):return ''.join('%04X'%gid[c] for c in s)
bf=''.join('<%04X> <%04X>\n'%(g,ord(c)) for c,g in sorted(gid.items(),key=lambda x:x[1]))
tou=f"/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CMapName /Adobe-Identity-UCS def /CMapType 2 def 1 begincodespacerange <0000> <FFFF> endcodespacerange {len(gid)} beginbfchar\n{bf}endbfchar endcmap CMapName currentdict /CMap defineresource pop end end"
content=f"BT /F1 24 Tf 50 700 Td <{hexs('Hello')}> Tj ET\nBT /F1 24 Tf 50 650 Td <{hexs('World')}> Tj <{hexs('2026')}> Tj ET"
objs=[]
def add(b):objs.append(b);return len(objs)
add(b'<< /Type /Catalog /Pages 2 0 R >>');add(b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>')
add(b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>')
add(b'<< /Length %d >>\nstream\n'%len(content)+content.encode()+b'\nendstream')
add(b'<< /Type /Font /Subtype /Type0 /BaseFont /ABCDEF+FreeSans /Encoding /Identity-H /DescendantFonts [6 0 R] /ToUnicode 8 0 R >>')
add(b'<< /Type /Font /Subtype /CIDFontType2 /BaseFont /ABCDEF+FreeSans /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor 7 0 R /CIDToGIDMap /Identity /DW 600 >>')
add(b'<< /Type /FontDescriptor /FontName /ABCDEF+FreeSans /Flags 4 /FontBBox [0 0 1000 1000] /ItalicAngle 0 /Ascent 900 /Descent -200 /CapHeight 700 /StemV 80 /FontFile2 9 0 R >>')
add(b'<< /Length %d >>\nstream\n'%len(tou)+tou.encode()+b'\nendstream')
add(b'<< /Length %d /Length1 %d >>\nstream\n'%(len(fontdata),len(fontdata))+fontdata+b'\nendstream')
out=bytearray(b'%PDF-1.5\n');offs=[]
for i,o in enumerate(objs):offs.append(len(out));out+=b'%d 0 obj\n'%(i+1)+o+b'\nendobj\n'
x=len(out);out+=b'xref\n0 %d\n0000000000 65535 f \n'%(len(objs)+1)
for o in offs:out+=b'%010d 00000 n \n'%o
out+=b'trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF'%(len(objs)+1,x)
open(sys.argv[1],'wb').write(out)
import json;json.dump({c:'%04X'%g for c,g in gid.items()},open(sys.argv[1]+'.json','w'))
