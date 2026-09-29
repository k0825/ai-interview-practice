import type { InterviewMode, InterviewQuestion } from "@/lib/interview-modes/types";
import { calculateEvaluation } from "./scoring";

type JevAnswer = { type?: string; score?: number; confidence?: number };

export class JevUnavailableError extends Error {}

export function buildJevQuestions(mode: InterviewMode) {
  return Object.fromEntries(mode.dimensions.map((dimension) => [
    dimension.id,
    {
      type: "score",
      instructions: dimension.instructions,
      criteria: dimension.criteria
    }
  ]));
}

export async function evaluateWithJev(mode: InterviewMode, question: InterviewQuestion, transcript: string) {
  const key = process.env.TYPESAFE_API_KEY;
  if (!key) throw new JevUnavailableError("TYPESAFE_API_KEY が設定されていません。TypeSafeのダッシュボードでAPIキーを取得してください。");
  const response = await fetch("https://api.typesafe.ai/v1/systemone", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "jev-latest",
      state: `面接モード: ${mode.title}\n質問: ${question.text}\n回答: ${transcript}`,
      questions: buildJevQuestions(mode)
    }),
    signal: AbortSignal.timeout(20000),
    cache: "no-store"
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new JevUnavailableError("TypeSafeのAPIキーまたはJevの利用権限を確認してください。");
    }
    if (response.status === 402) {
      throw new JevUnavailableError("TypeSafeのJev利用残高が不足しています。");
    }
    if (response.status === 429) {
      throw new JevUnavailableError("TypeSafeの利用制限に達しました。少し待ってから再試行してください。");
    }
    throw new Error(`Jev の採点に失敗しました (HTTP ${response.status})。`);
  }
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== "object" || !("answers" in payload) ||
      !payload.answers || typeof payload.answers !== "object") {
    throw new Error("Jev の応答形式を確認できませんでした。");
  }
  const answers = payload.answers as Record<string, JevAnswer>;
  const rawScores = Object.fromEntries(mode.dimensions.map((dimension) => {
    const answer = answers[dimension.id];
    if (!answer || answer.type !== "score" || typeof answer.score !== "number") {
      throw new Error(`Jev の評価項目「${dimension.label}」が不足しています。`);
    }
    return [dimension.id, {
      score: answer.score,
      confidence: typeof answer.confidence === "number" ? answer.confidence : null
    }];
  }));
  return calculateEvaluation(mode, question.id, rawScores);
}
