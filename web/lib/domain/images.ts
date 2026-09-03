/**
 * What we accept as a logo, decided by looking at the bytes.
 *
 * The browser's declared content type is a hint from whoever is uploading,
 * so it decides nothing here. The bucket is public-read and the file ends up
 * in an <img src> on the catalogue page, which is a bad place to discover
 * that a "logo" was something else.
 *
 * SVG is deliberately not on the list. It is a document format that can carry
 * script, and a public URL serving attacker-authored markup is a phishing page
 * we would be hosting. Every real logo exists as PNG, JPEG or WebP.
 */

export type LogoKind = { mime: string; ext: string };

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff];

/** The image format these bytes actually are, or null if it is not one we take. */
export function sniffLogo(bytes: Uint8Array): LogoKind | null {
  if (starts(bytes, PNG)) return { mime: "image/png", ext: "png" };
  if (starts(bytes, JPEG)) return { mime: "image/jpeg", ext: "jpg" };
  // RIFF....WEBP — the four bytes between are the file length.
  if (ascii(bytes, 0, "RIFF") && ascii(bytes, 8, "WEBP")) {
    return { mime: "image/webp", ext: "webp" };
  }
  return null;
}

export const MAX_LOGO_BYTES = 2 * 1024 * 1024;

/** For the file input's accept attribute, and for the sentence under it. */
export const LOGO_ACCEPT = "image/png,image/jpeg,image/webp";

function starts(bytes: Uint8Array, sig: number[]): boolean {
  if (bytes.length < sig.length) return false;
  return sig.every((b, i) => bytes[i] === b);
}

function ascii(bytes: Uint8Array, at: number, text: string): boolean {
  if (bytes.length < at + text.length) return false;
  for (let i = 0; i < text.length; i++) {
    if (bytes[at + i] !== text.charCodeAt(i)) return false;
  }
  return true;
}
