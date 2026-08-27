import { describe, expect, it } from "vitest";
import { detectFaceHeuristic } from "../worker/lib/face";

describe("face heuristic", () => {
  it("accepts skin-tone heavy thumbnail bytes", () => {
    const bytes = new Uint8Array(1200);
    for (let i = 0; i < bytes.length; i += 3) {
      bytes[i] = 200;
      bytes[i + 1] = 120;
      bytes[i + 2] = 80;
    }
    expect(detectFaceHeuristic(bytes.buffer)).toBe(true);
  });

  it("rejects tiny or flat images", () => {
    expect(detectFaceHeuristic(new Uint8Array(100).buffer)).toBe(false);
    expect(detectFaceHeuristic(new Uint8Array(1200).buffer)).toBe(false);
  });
});
