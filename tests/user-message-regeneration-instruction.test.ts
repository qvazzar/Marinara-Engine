import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildUserMessageRegenerationInstruction } from "../packages/server/src/routes/generate/generate-route-utils.ts";

describe("user message regeneration instruction", () => {
  it("asks the provider to rewrite the user message as a swipe", () => {
    const instruction = buildUserMessageRegenerationInstruction({ content: "try again" });

    assert.match(instruction, /Regenerate the user's previous message as an alternate swipe/);
    assert.match(instruction, /Write only the replacement user message text/);
    assert.match(instruction, /Do not answer as the assistant/);
    assert.match(instruction, /<original_user_message>\ntry again\n<\/original_user_message>/);
  });
});
