# PDF Editor 1.1 – what changed

## Shapes & pictures (smart objects)
* Shapes are read from the PDF's real drawing instructions (exact outline, fill, stroke, clip, stroke width) – no more guessed boxes.
* A shape stays a **vector** object: move, resize (free), rotate, change fill / line colour / line width. Never turned into an image.
* Text on a shape is never merged into it. It stays real, editable text at full quality.
* Pictures are taken at their **native resolution** (not a screenshot).
* Stacking order is exact: page content below / between / above each lifted object is rendered as separate layers.
* Saving removes the original object from the PDF's content stream and puts the new vector copy at the same z-order position.
* Double-click any solid colour area: matched to the PDF shape by colour + size, otherwise grabbed as a high-res region.

## Bengali
* Text stored in glyph order (ে ি ৈ before the consonant, reph after it, ো split in two) is repaired to real Unicode.
* Every Bengali line is checked against the original pixels (all candidate texts x all candidate fonts); the best match wins.
* Edited Bengali is saved as **vector outlines** shaped with GSUB/GPOS (exactly what the browser shows). A pixel guard falls back to a 5x raster only if outlines would differ.
* Bijoy/ANSI PDFs: the PDF's own embedded font is used; "Add font file" for the full font.

## Learning (persistent)
* `userData/learned/memory.json` – which font family / text order worked for each PDF font name, plus usage counters.
* `userData/learned/fonts/` – every downloaded or added font is stored once and reused forever (also offline).
* Next time the same font appears, only the remembered font is tested, so opening gets faster and more accurate.

Run the logic tests with `npm test`.
