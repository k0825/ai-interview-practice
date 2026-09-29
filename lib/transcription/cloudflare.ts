export async function transcribeWithCloudflare(audio: File): Promise<string> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !token) {
    throw new Error("Cloudflare の認証情報が設定されていません。");
  }
  const bytes = Buffer.from(await audio.arrayBuffer());
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/@cf/openai/whisper-large-v3-turbo`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ audio: bytes.toString("base64"), task: "transcribe", language: "ja" }),
      signal: AbortSignal.timeout(60000),
      cache: "no-store"
    }
  );
  if (!response.ok) throw new Error(`文字起こしに失敗しました (HTTP ${response.status})。`);
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== "object" || !("result" in payload) ||
      !payload.result || typeof payload.result !== "object" ||
      !("text" in payload.result) || typeof payload.result.text !== "string") {
    throw new Error("Cloudflare の応答形式を確認できませんでした。");
  }
  const transcript = payload.result.text.trim();
  if (!transcript) throw new Error("音声から回答を読み取れませんでした。");
  return transcript;
}
