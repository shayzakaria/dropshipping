/**
 * Puts Hebrew text into visual order, for renderers that have no bidi.
 *
 * Satori — what `next/og` draws images with — lays glyphs out strictly in the
 * order the string gives them, and ignores `direction: rtl`. Hand it logical
 * Hebrew and every line comes out mirrored: "קוד קופון" renders as "ןופוק דוק".
 * The browser is unaffected; this exists only for generated images.
 *
 * The approach is the readable half of the Unicode bidi algorithm. The string
 * is split into tokens, where a token is either one character or a whole run
 * that reads left-to-right on its own — a Latin word, or a number with the
 * separators that belong to it. Reversing the tokens flips the Hebrew while
 * leaving "300", "3.5", "3%" and "BOOST" spelled forwards.
 *
 * Doing this by character instead is the obvious version and is wrong: it
 * turns "3%" into "%3", because the percent sign is not a digit.
 *
 * It is not the full algorithm — no nested embeddings, no bracket mirroring —
 * which is more than a heading of our own words needs.
 */

/** Hebrew block, plus presentation forms some fonts carry. */
const RTL = /[֐-׿יִ-ﭏ]/;

/**
 * One left-to-right run: a Latin word or a number, keeping the separators
 * that sit *between* its parts, plus a trailing percent or degree sign.
 */
const LTR_RUN = /[A-Za-z0-9]+(?:[.,:/'’-][A-Za-z0-9]+)*%?/g;

export function visualRtl(text: string): string {
  // Nothing right-to-left in it, so there is no reordering to do — and doing
  // it anyway would turn "BOOST 2026" into "2026 BOOST".
  if (!RTL.test(text)) return text;

  const tokens: string[] = [];
  let at = 0;
  for (const m of text.matchAll(LTR_RUN)) {
    // Everything before this run is ordinary text, one character per token.
    for (const ch of text.slice(at, m.index)) tokens.push(ch);
    tokens.push(m[0]);
    at = m.index + m[0].length;
  }
  for (const ch of text.slice(at)) tokens.push(ch);

  return tokens.reverse().join("");
}

/** True when a string carries any Hebrew at all. */
export function hasHebrew(text: string): boolean {
  return RTL.test(text);
}
