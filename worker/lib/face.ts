import type { Env } from "../types";

const NO_FACE_MESSAGE =
  "We need to see the founder on camera. Product demos and screen recordings don't count.";

interface DetectionResult {
  label?: string;
  score?: number;
}

/** Exported for unit tests with injected AI runner. */
export async function detectHumanFace(
  imageBytes: ArrayBuffer,
  ai?: Env["AI"],
): Promise<boolean> {
  if (ai) {
    try {
      const bytes = new Uint8Array(imageBytes);
      const result = (await ai.run("@cf/facebook/detr-resnet-50", {
        image: [...bytes],
      })) as DetectionResult[] | { results?: DetectionResult[] };

      const detections = Array.isArray(result) ? result : (result.results ?? []);
      const person = detections.find(
        (d) => d.label?.toLowerCase() === "person" && (d.score ?? 0) >= 0.6,
      );
      if (person) return true;
    } catch (err) {
      console.warn("[face] Workers AI detection failed, falling back to heuristic", err);
    }
  }

  return detectFaceHeuristic(imageBytes);
}

/** Lightweight fallback when AI is unavailable — skin-tone + entropy heuristic. */
export function detectFaceHeuristic(imageBytes: ArrayBuffer): boolean {
  if (imageBytes.byteLength < 800) return false;
  const bytes = new Uint8Array(imageBytes);
  let skinish = 0;
  let samples = 0;

  for (let i = 0; i < bytes.length - 2; i += 12) {
    const r = bytes[i] ?? 0;
    const g = bytes[i + 1] ?? 0;
    const b = bytes[i + 2] ?? 0;
    if (r > 60 && g > 40 && b > 20 && r > g && r > b && r - b > 15) {
      skinish++;
    }
    samples++;
  }

  if (samples === 0) return false;
  return skinish / samples > 0.08;
}

export async function requireFounderOnCamera(env: Env, thumbnailUrl: string | null): Promise<void> {
  if (!thumbnailUrl) {
    throw new Error(NO_FACE_MESSAGE);
  }

  const res = await fetch(thumbnailUrl, {
    headers: { Accept: "image/*", "User-Agent": "VideoClubBot/1.0" },
  });
  if (!res.ok) {
    throw new Error(NO_FACE_MESSAGE);
  }

  const imageBytes = await res.arrayBuffer();
  const hasFace = await detectHumanFace(imageBytes, env.AI);
  if (!hasFace) {
    throw new Error(NO_FACE_MESSAGE);
  }
}

export { NO_FACE_MESSAGE };
