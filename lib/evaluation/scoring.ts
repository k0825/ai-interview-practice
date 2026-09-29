import type { InterviewMode, Grade } from "@/lib/interview-modes/types";
import type { DimensionScore, EvaluationResult } from "@/types/interview";

export function toDisplayScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round((score / 9) * 10) * 10));
}

export function gradeFor(score: number, mode: InterviewMode): Grade {
  const { A, B, C } = mode.gradeThresholds;
  return score >= A ? "A" : score >= B ? "B" : score >= C ? "C" : "D";
}

export function calculateEvaluation(
  mode: InterviewMode,
  questionId: string,
  rawScores: Record<string, { score: number; confidence: number | null }>
): EvaluationResult {
  const scores: Record<string, DimensionScore> = {};
  let overall = 0;
  for (const dimension of mode.dimensions) {
    const answer = rawScores[dimension.id];
    if (!answer || !Number.isFinite(answer.score) || answer.score < 0 || answer.score > 9) {
      throw new Error(`Invalid Jev score for ${dimension.id}`);
    }
    scores[dimension.id] = {
      rawScore: answer.score,
      displayScore: toDisplayScore(answer.score),
      confidence: answer.confidence
    };
    overall += (answer.score / 9) * 100 * dimension.weight;
  }
  const overallScore = Math.round(overall);
  return { modeId: mode.id, questionId, scores, overallScore, grade: gradeFor(overallScore, mode) };
}
