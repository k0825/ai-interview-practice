import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ScoreBreakdown } from "../components/ScoreBreakdown";
import { ScoreHero } from "../components/ScoreHero";
import { interviewModes } from "../lib/interview-modes";
import type { InterviewMode } from "../lib/interview-modes/types";
import { buildJevQuestions, evaluateWithJev, JevUnavailableError } from "../lib/evaluation/jev";
import { calculateEvaluation, toDisplayScore } from "../lib/evaluation/scoring";
import { buildFeedbackPrompt } from "../lib/feedback/codex";

test("each configured mode has valid rubrics, questions and weights", () => {
  assert.deepEqual(interviewModes.map((mode) => mode.id), ["gakuchika", "motivation", "self-pr"]);
  for (const mode of interviewModes) {
    assert.ok(mode.questions.length >= 1);
    assert.ok(Math.abs(mode.dimensions.reduce((sum, item) => sum + item.weight, 0) - 1) < 0.000001);
    assert.ok(mode.dimensions.every((item) => item.criteria.length === 10));
    const questions = buildJevQuestions(mode);
    assert.deepEqual(Object.keys(questions), mode.dimensions.map((item) => item.id));
    for (const dimension of mode.dimensions) {
      assert.deepEqual(questions[dimension.id], {
        type: "score",
        instructions: dimension.instructions,
        criteria: dimension.criteria
      });
    }
  }
});

test("Jev request and response follow the selected mode's dimensions", async () => {
  const mode = interviewModes[1];
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.TYPESAFE_API_KEY;
  let requestBody: Record<string, unknown> | null = null;
  let requestUrl = "";
  let authorization = "";
  process.env.TYPESAFE_API_KEY = "test-key";
  globalThis.fetch = async (input, init) => {
    requestUrl = String(input);
    authorization = new Headers(init?.headers).get("Authorization") || "";
    requestBody = JSON.parse(String(init?.body));
    return Response.json({
      answers: Object.fromEntries(mode.dimensions.map((item) => [
        item.id,
        { type: "score", score: 7, confidence: 0.6 }
      ]))
    });
  };
  try {
    const result = await evaluateWithJev(mode, mode.questions[0], "志望理由のテスト回答");
    const sentBody = requestBody as Record<string, unknown> | null;
    assert.ok(sentBody);
    assert.equal(requestUrl, "https://api.typesafe.ai/v1/systemone");
    assert.equal(authorization, "Bearer test-key");
    assert.equal(sentBody.model, "jev-latest");
    assert.deepEqual(Object.keys(sentBody.questions as object), mode.dimensions.map((item) => item.id));
    assert.equal(result.modeId, "motivation");
    assert.equal(result.overallScore, 78);
    assert.equal(result.grade, "B");
    assert.ok(mode.dimensions.every((item) => result.scores[item.id].confidence === 0.6));
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.TYPESAFE_API_KEY;
    else process.env.TYPESAFE_API_KEY = originalKey;
  }
});

test("TypeSafe authentication rejection produces a clear unavailable error", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.TYPESAFE_API_KEY;
  process.env.TYPESAFE_API_KEY = "test-key";
  globalThis.fetch = async () => Response.json(
    { detail: "Invalid API key" },
    { status: 401 }
  );
  try {
    await assert.rejects(
      evaluateWithJev(interviewModes[0], interviewModes[0].questions[0], "テスト回答"),
      (error: unknown) => error instanceof JevUnavailableError && error.message.includes("APIキー")
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.TYPESAFE_API_KEY;
    else process.env.TYPESAFE_API_KEY = originalKey;
  }
});

test("a Vercel key does not silently substitute for the TypeSafe key", async () => {
  const originalTypeSafeKey = process.env.TYPESAFE_API_KEY;
  const originalGatewayKey = process.env.AI_GATEWAY_API_KEY;
  delete process.env.TYPESAFE_API_KEY;
  process.env.AI_GATEWAY_API_KEY = "old-gateway-key";
  try {
    await assert.rejects(
      evaluateWithJev(interviewModes[0], interviewModes[0].questions[0], "テスト回答"),
      (error: unknown) => error instanceof JevUnavailableError && error.message.includes("TYPESAFE_API_KEY")
    );
  } finally {
    if (originalTypeSafeKey === undefined) delete process.env.TYPESAFE_API_KEY;
    else process.env.TYPESAFE_API_KEY = originalTypeSafeKey;
    if (originalGatewayKey === undefined) delete process.env.AI_GATEWAY_API_KEY;
    else process.env.AI_GATEWAY_API_KEY = originalGatewayKey;
  }
});

test("a mode with two dimensions uses raw weighted scores and its own thresholds", () => {
  const mode: InterviewMode = {
    id: "test",
    title: "test",
    description: "",
    questions: [{ id: "q", text: "Q" }],
    dimensions: [
      { id: "first", label: "First", weight: 0.25, instructions: "one", criteria: ["0","1","2","3","4","5","6","7","8","9"] },
      { id: "second", label: "Second", weight: 0.75, instructions: "two", criteria: ["0","1","2","3","4","5","6","7","8","9"] }
    ],
    gradeThresholds: { A: 90, B: 50, C: 20 },
    feedbackInstructions: ""
  };
  const result = calculateEvaluation(mode, "q", {
    first: { score: 9, confidence: 0.8 },
    second: { score: 0, confidence: null }
  });
  assert.equal(result.overallScore, 25);
  assert.equal(result.grade, "C");
  assert.equal(result.scores.first.displayScore, 100);
  assert.equal(result.scores.second.displayScore, 0);
  assert.equal(result.scores.first.confidence, 0.8);
  assert.equal(toDisplayScore(8.11), 90);
  assert.equal(toDisplayScore(4.37), 50);
  const breakdown = renderToStaticMarkup(createElement(ScoreBreakdown, { mode, evaluation: result }));
  assert.equal((breakdown.match(/class="score-row"/g) || []).length, 2);
  assert.match(breakdown, /2項目/);
  assert.match(renderToStaticMarkup(createElement(ScoreHero, { evaluation: result })), /25/);
  assert.throws(() => calculateEvaluation(mode, "q", { first: { score: 9, confidence: null } }), /Invalid Jev score/);
});

test("feedback receives mode-specific guidance without changing Jev grades", () => {
  const mode = interviewModes[2];
  const result = calculateEvaluation(mode, mode.questions[0].id, Object.fromEntries(
    mode.dimensions.map((dimension) => [dimension.id, { score: 6.5, confidence: null }])
  ));
  const prompt = buildFeedbackPrompt(mode, mode.questions[0], "私は改善しました。", result);
  assert.ok(prompt.includes(mode.feedbackInstructions));
  assert.ok(prompt.includes("独自に再採点したりしないでください"));
  assert.ok(prompt.includes(`"overallScore": ${result.overallScore}`));
});
