import { NextResponse } from "next/server";
import { z } from "zod";
import { getMode, getQuestion } from "@/lib/interview-modes";
import { evaluateWithJev, JevUnavailableError } from "@/lib/evaluation/jev";

export const runtime = "nodejs";

const requestSchema = z.object({
  modeId: z.string(),
  questionId: z.string(),
  transcript: z.string().trim().min(1).max(10000)
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "回答データが正しくありません。" }, { status: 400 });
  }
  const { modeId, questionId, transcript } = parsed.data;
  const mode = getMode(modeId);
  const question = mode && getQuestion(mode, questionId);
  if (!mode || !question) {
    return NextResponse.json({ error: "面接モードまたは質問が見つかりません。" }, { status: 404 });
  }
  try {
    return NextResponse.json(await evaluateWithJev(mode, question, transcript));
  } catch (error) {
    console.error("Evaluation failed:", error);
    const message = error instanceof DOMException && error.name === "TimeoutError"
      ? "採点がタイムアウトしました。"
      : error instanceof Error ? error.message : "採点に失敗しました。";
    return NextResponse.json({ error: message }, { status: error instanceof JevUnavailableError ? 424 : 502 });
  }
}
