import sharp from "sharp";
import path from "node:path";
import fs from "node:fs";

const uploadDir = "C:/Users/AdsLaptop01/.gemini/antigravity/brain/9385c7a6-521f-475e-9a28-ceb6f714b614/.user_uploaded";
const outputDir = "d:/bidwar/artifacts/auction-platform/public/assets/evidence";

const images = [
  {
    input: path.join(uploadDir, "media_1789848796625.jpg"),
    output: path.join(outputDir, "vnbl-chhavi-gera-bidding.jpg"),
    name: "Chhavi Gera Bidding Reveal on Stage",
  },
  {
    input: path.join(uploadDir, "media_1789848796677.jpg"),
    output: path.join(outputDir, "vnbl-stage-team-group.jpg"),
    name: "Organizers & Committee Stage Group",
  },
  {
    input: path.join(uploadDir, "media_1789848796694.jpg"),
    output: path.join(outputDir, "vnbl-top5-leaderboard.jpg"),
    name: "Top 5 Sold Leaderboard LED Screen",
  },
  {
    input: path.join(uploadDir, "media_1789848796711.jpg"),
    output: path.join(outputDir, "vnbl-womens-purse-auctioneer.jpg"),
    name: "Women's League Purse & Live Auctioneer",
  },
];

async function processImages() {
  for (const item of images) {
    if (!fs.existsSync(item.input)) {
      console.warn(`File not found: ${item.input}`);
      continue;
    }

    console.log(`Processing: ${item.name} (${path.basename(item.input)})...`);

    await sharp(item.input)
      .rotate()
      .resize({
        width: 1600,
        height: 1066,
        fit: "inside",
        withoutEnlargement: true,
        kernel: sharp.kernel.lanczos3,
      })
      .modulate({
        brightness: 1.05,
        saturation: 1.15,
      })
      .normalize({ lower: 1, upper: 99 })
      .sharpen({
        sigma: 1.1,
        m1: 1.3,
        m2: 0.5,
      })
      .jpeg({
        quality: 88,
        mozjpeg: true,
        chromaSubsampling: "4:4:4",
      })
      .toFile(item.output);

    const stats = fs.statSync(item.output);
    console.log(`Saved ${path.basename(item.output)} - Size: ${(stats.size / 1024).toFixed(1)} KB`);
  }
}

processImages()
  .then(() => console.log("Photos processed successfully!"))
  .catch((err) => {
    console.error("Error processing photos:", err);
    process.exit(1);
  });
