import type { Grade } from "@/lib/interview-modes/types";

export type DimensionScore = {
  rawScore: number;
  displayScore: number;
  confidence: number | null;
};

export type EvaluationResult = {
  modeId: string;
  questionId: string;
  scores: Record<string, DimensionScore>;
  overallScore: number;
  grade: Grade;
};

export type InterviewFeedback = {
  strengths: { title: string; explanation: string }[];
  improvements: { title: string; explanation: string; suggestion: string }[];
  improvedAnswer: string;
  followUpQuestions: string[];
};
