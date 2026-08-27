/**
 * Live network check for YouTube description fetching (InnerTube + HTML fallbacks).
 * Run: bun run scripts/test-youtube-description.ts
 */
import { extractProductUrl } from "../worker/lib/urls";
import { fetchVideoMetadata } from "../worker/lib/video";

const SHORT_URL = "https://youtube.com/shorts/-abGcOfoKHg";
const VIDEO_ID = "-abGcOfoKHg";

async function main() {
  console.log(`Fetching metadata for ${SHORT_URL} ...\n`);

  const metadata = await fetchVideoMetadata(SHORT_URL, {
    youtubeApiKey: process.env.YOUTUBE_API_KEY,
  });

  const productUrl = extractProductUrl(metadata.description);

  console.log("videoId:", metadata.videoId);
  console.log("title:", metadata.title);
  console.log("description length:", metadata.description.length);
  console.log("description preview:", metadata.description.slice(0, 240).replace(/\n/g, " "));
  console.log("publishedAt:", metadata.publishedAt);
  console.log("productUrl:", productUrl);

  if (metadata.videoId !== VIDEO_ID) {
    throw new Error(`Expected video id ${VIDEO_ID}, got ${metadata.videoId}`);
  }
  if (!metadata.description.trim()) {
    throw new Error("Description is empty — YouTube may be blocking this IP");
  }
  if (!productUrl?.includes("capgo.app")) {
    throw new Error(`Expected capgo.app in product URL, got ${productUrl ?? "null"}`);
  }

  console.log("\nOK — description and capgo.app product link found.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
