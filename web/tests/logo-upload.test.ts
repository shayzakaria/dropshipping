import { describe, expect, it } from "vitest";
import { sniffLogo } from "../lib/domain/images";

const png = () => bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const jpeg = () => bytes([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46]);
const webp = () => {
  const b = new Uint8Array(16);
  b.set(ascii("RIFF"), 0);
  b.set(ascii("WEBP"), 8);
  return b;
};

describe("what counts as a logo", () => {
  it("recognises the three formats we serve", () => {
    expect(sniffLogo(png())?.mime).toBe("image/png");
    expect(sniffLogo(jpeg())?.mime).toBe("image/jpeg");
    expect(sniffLogo(webp())?.mime).toBe("image/webp");
  });

  it("gives each format the extension the bucket expects", () => {
    expect(sniffLogo(png())?.ext).toBe("png");
    expect(sniffLogo(jpeg())?.ext).toBe("jpg");
    expect(sniffLogo(webp())?.ext).toBe("webp");
  });

  it("refuses SVG, which is markup and would be served from a public URL", () => {
    expect(sniffLogo(ascii('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
  });

  it("refuses HTML dressed up with an image name", () => {
    expect(sniffLogo(ascii("<!doctype html><script>alert(1)</script>"))).toBeNull();
  });

  it("refuses a script whose declared content type says image", () => {
    // The browser sends the content type; the bytes are what we believe.
    expect(sniffLogo(ascii("#!/bin/sh\nrm -rf /\n"))).toBeNull();
  });

  it("does not read past the end of a truncated file", () => {
    expect(sniffLogo(bytes([0x89, 0x50]))).toBeNull();
    expect(sniffLogo(ascii("RIFF"))).toBeNull();
    expect(sniffLogo(new Uint8Array(0))).toBeNull();
  });

  it("refuses a RIFF container that is not WebP", () => {
    const wav = new Uint8Array(16);
    wav.set(ascii("RIFF"), 0);
    wav.set(ascii("WAVE"), 8);
    expect(sniffLogo(wav)).toBeNull();
  });
});

function bytes(list: number[]): Uint8Array {
  return Uint8Array.from(list);
}

function ascii(text: string): Uint8Array {
  return Uint8Array.from(text, (c) => c.charCodeAt(0));
}
