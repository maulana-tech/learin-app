import assert from "node:assert/strict";
import { test } from "node:test";

import { encodeAI, maskKey } from "./ai-config.ts";

test("AI settings travel as base64 UTF-8 JSON, which the agent service decodes", () => {
  const cfg = { provider: "gemini", base_url: "https://x/v1", model: "gemini-2.5-flash", api_key: "AIza-ü-key" };
  const back = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(encodeAI(cfg)), (c) => c.charCodeAt(0))));
  assert.deepEqual(back, cfg);
});

test("a key is never shown whole", () => {
  assert.equal(maskKey(""), "no key");
  assert.equal(maskKey("short"), "••••");
  assert.equal(maskKey("sk-abcdefghijklmnop"), "sk-…mnop");
});
