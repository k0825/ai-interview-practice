import { NextResponse } from "next/server";
import { transcribeWithCloudflare } from "@/lib/transcription/cloudflare";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) {
    return NextResponse.json({ error: "音声ファイルを送信してください。" }, { status: 400 });
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "音声ファイルの形式が正しくありません。" }, { status: 400 });
  }
  try {
    const audio = form.get("audio");
    if (!(audio instanceof File) || !audio.type.startsWith("audio/")) {
      return NextResponse.json({ error: "音声ファイルを送信してください。" }, { status: 400 });
    }
    if (audio.size < 1000) {
      return NextResponse.json({ error: "録音が短すぎます。もう一度お試しください。" }, { status: 400 });
    }
    if (audio.size > 12 * 1024 * 1024) {
      return NextResponse.json({ error: "録音が長すぎます。短くして再録音してください。" }, { status: 413 });
    }
    return NextResponse.json({ transcript: await transcribeWithCloudflare(audio) });
  } catch (error) {
    console.error("Transcription failed:", error);
    const message = error instanceof DOMException && error.name === "TimeoutError"
      ? "文字起こしがタイムアウトしました。"
      : error instanceof Error ? error.message : "文字起こしに失敗しました。";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
