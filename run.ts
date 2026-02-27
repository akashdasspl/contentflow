import 'dotenv/config';  
import { generatePlatformContent } from "./src/services/content-generators";

async function main() {
  const result = await generatePlatformContent("social-post", {
    contentIdea: "AI in education",
    userId: "test-user",
    platform: "linkedin"
  });

  console.log(result.generatedText);
}

main();