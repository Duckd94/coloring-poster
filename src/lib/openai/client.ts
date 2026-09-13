import OpenAI from "openai";

// KHÔNG dùng "gpt-image-1" — deprecated 23/10/2026 (CLAUDE.md).
export const IMAGE_MODEL = "gpt-image-2.5-sunburst";

let client: OpenAI | undefined;

// Lazy init — tránh throw lúc build/import khi OPENAI_API_KEY chưa set.
export function getOpenAIClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}
