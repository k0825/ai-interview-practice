import { NextResponse } from "next/server";
import { z } from "zod";
import { getMode, getQuestion } from "@/lib/interview-modes";
import { calculateEvaluation } from "@/lib/evaluation/scoring";
import { generateFeedback } from "@/lib/feedback/codex";

export const runtime = "nodejs";

const requestSchema = z.object({
  modeId: z.string(),
  questionId: z.string(),
  transcript: z.string().trim().min(1).max(10000),
  evaluation: z.object({
    modeId: z.string(),
    questionId: z.string(),
    scores: z.record(z.string(), z.object({
      rawScore: z.number().min(0).max(9),
      displayScore: z.number(),
      confidence: z.number().nullable()
    })),
    overallScore: z.number(),
    grade: z.enum(["A", "B", "C", "D"])
  })
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "講評データが正しくありません。" }, { status: 400 });
  }
  const { modeId, questionId, transcript, evaluation } = parsed.data;
  const mode = getMode(modeId);
  const question = mode && getQuestion(mode, questionId);
  if (!mode || !question) {
    return NextResponse.json({ error: "面接モードまたは質問が見つかりません。" }, { status: 404 });
  }
  if (evaluation.modeId !== modeId || evaluation.questionId !== questionId) {
    return NextResponse.json({ error: "採点結果と質問が一致しません。" }, { status: 400 });
  }
  try {
    const confirmed = calculateEvaluation(mode, questionId, Object.fromEntries(
      mode.dimensions.map((dimension) => [
        dimension.id,
        { score: evaluation.scores[dimension.id]?.rawScore, confidence: evaluation.scores[dimension.id]?.confidence ?? null }
      ])
    ));
    if (confirmed.overallScore !== evaluation.overallScore || confirmed.grade !== evaluation.grade ||
        mode.dimensions.some((dimension) =>
          confirmed.scores[dimension.id].displayScore !== evaluation.scores[dimension.id]?.displayScore
        )) {
      return NextResponse.json({ error: "採点結果が一致しません。" }, { status: 400 });
    }
    return NextResponse.json(await generateFeedback(mode, question, transcript, confirmed));
  } catch (error) {
    console.error("Feedback failed:", error);
    return NextResponse.json({ error: "詳しいフィードバックの生成に失敗しました。" }, { status: 502 });
  }
}
