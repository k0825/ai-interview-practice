import { Codex } from "@openai/codex-sdk";
import { z } from "zod";
import type { InterviewMode, InterviewQuestion } from "@/lib/interview-modes/types";
import type { EvaluationResult, InterviewFeedback } from "@/types/interview";

const feedbackSchema = z.object({
  strengths: z.array(z.object({ title: z.string(), explanation: z.string() })).min(1),
  improvements: z.array(z.object({ title: z.string(), explanation: z.string(), suggestion: z.string() })).min(1),
  improvedAnswer: z.string().min(1),
  followUpQuestions: z.array(z.string()).min(1)
});

const outputSchema = {
  type: "object",
  properties: {
    strengths: {
      type: "array",
      items: {
        type: "object",
        properties: { title: { type: "string" }, explanation: { type: "string" } },
        required: ["title", "explanation"],
        additionalProperties: false
      }
    },
    improvements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          explanation: { type: "string" },
          suggestion: { type: "string" }
        },
        required: ["title", "explanation", "suggestion"],
        additionalProperties: false
      }
    },
    improvedAnswer: { type: "string" },
    followUpQuestions: { type: "array", items: { type: "string" } }
  },
  required: ["strengths", "improvements", "improvedAnswer", "followUpQuestions"],
  additionalProperties: false
};

export function buildFeedbackPrompt(
  mode: InterviewMode,
  question: InterviewQuestion,
  transcript: string,
  evaluation: EvaluationResult
): string {
  const dimensions = mode.dimensions.map((dimension) => ({
    label: dimension.label,
    rawScore: evaluation.scores[dimension.id].rawScore,
    displayScore: evaluation.scores[dimension.id].displayScore
  }));
  return `あなたは日本語の面接練習コーチです。以下のJev採点結果は確定済みです。点数・評価ランクを変更したり、独自に再採点したりしないでください。
元の面接回答とJevの評価結果を根拠に、評価の理由と改善方法を具体的に説明してください。
回答の表現を具体的に引用し、抽象的な助言を避けてください。元回答にない企業情報、役割、数字、成果を作らないでください。改善例に不足情報が必要なら、本人が実際の情報を補うための［具体的な数字を入れる］のようなプレースホルダーを使ってください。
ファイルの読み書きや外部ツールの実行は不要です。JSONスキーマに従う日本語の講評だけを返してください。

モード: ${mode.title}
モード固有の講評方針:
${mode.feedbackInstructions}

質問: ${question.text}
回答:
${transcript}

確定済み採点:
${JSON.stringify({ dimensions, overallScore: evaluation.overallScore, grade: evaluation.grade }, null, 2)}

strengths は良かった点、improvements は改善点と具体的な改善方法、improvedAnswer は元回答の事実だけで構成する改善後の回答例、followUpQuestions は追加質問です。`;
}

export async function generateFeedback(
  mode: InterviewMode,
  question: InterviewQuestion,
  transcript: string,
  evaluation: EvaluationResult
): Promise<InterviewFeedback> {
  // The child process only receives what it needs for the local ChatGPT login.
  // In particular, the Cloudflare/Gateway secrets and any API billing key stay out.
  const childEnv = Object.fromEntries(
    ["PATH", "HOME", "USER", "TMPDIR", "LANG", "LC_ALL", "CODEX_HOME", "CODEX_CA_CERTIFICATE", "SSL_CERT_FILE"]
      .flatMap((key) => process.env[key] ? [[key, process.env[key] as string]] : [])
  );
  const codex = new Codex({ env: childEnv });
  const thread = codex.startThread({
    model: "gpt-6-sol",
    modelReasoningEffort: "low",
    workingDirectory: process.cwd(),
    skipGitRepoCheck: true,
    sandboxMode: "read-only",
    approvalPolicy: "never",
    networkAccessEnabled: false,
    webSearchMode: "disabled"
  });
  const result = await thread.run(buildFeedbackPrompt(mode, question, transcript, evaluation), {
    outputSchema,
    signal: AbortSignal.timeout(90000)
  });
  return feedbackSchema.parse(JSON.parse(result.finalResponse));
}
