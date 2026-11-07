# PDF Editor 2.0 – live updates + learning
* Editor logic updates itself from your GitHub repo (see UPDATES.md): checksum-verified, atomic, auto-rollback.
* ✍ Teach / 🤖 Read with AI turn corrections into permanent per-font word fixes; shareable through knowledge/fixes.json.
* ⚙ settings dialog, update banner.

# PDF Editor 1.4 – moving text leaves nothing behind
* Bug fix: after moving a line, the original text stayed visible (the cover was only drawn while typing). Moving now refreshes the preview.
* The live preview now performs the real removal: the edited words' original text operators are switched off in the page render (like the saved file), instead of hiding them under a coloured box. Falls back to the box only if the PDF's text operators can't be matched 1:1.
* All page re-renders are serialised (no more interleaving between picture lifts and text removal).

# PDF Editor 1.3 – word-level editing
* A line is compared **word by word** with the original. Only the words you change are covered, removed from the PDF and rewritten; every other word keeps its original glyphs, on screen and in the saved file.
  This is what makes PDFs with broken font-to-Unicode tables (e.g. SolaimanLipiNormal tickets) editable: the broken text is never re-typeset.
* If a PDF text piece contains several words, the region grows to that whole piece (unchanged words are re-typed from the same font).
* Moving / restyling a line, or lines marked unreadable, are still replaced as a whole line.
* NUL / U+FFFD placeholders from the PDF are removed from the editable text.
* On screen, unchanged words stay transparent (original pixels show through); only changed words are painted (CSS Custom Highlight API).

# PDF Editor 1.2 – what changed

## 1.2: real in-place editing, sharp display, Bengali merge fix
* **Edits happen inside the PDF.** The original text operators are removed from the page's content stream (no more cover boxes). New text is written in the same place.
* **Original font reused.** If the PDF's embedded font contains the letters you typed (checked through its ToUnicode map), the new text is encoded with that very font -> same look, same size, still selectable/searchable.
* If letters are missing from the embedded subset (or it is Bengali, or you changed font/size/position), vector outlines from the best matching full font are written instead, still in place.
* **Untouched lines are never rewritten.** Clicking a line no longer changes it; only lines whose text, font, size, colour or position actually changed are saved.
* **Sharp display:** pages are rendered at 2-3x and shown downscaled (was a fixed 1.5x bitmap).
* **Bengali fix:** Chrome-made PDFs store every Bengali glyph as its own piece. The merge step inserted spurious spaces ("এক্স ে স") and dropped lone marks (ৈ). Merging is now Bengali-aware.
* **Right-click any line = inspector** (PDF font, raw code points, chosen font, match score).

# PDF Editor 1.1

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
