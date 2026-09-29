export type Grade = "A" | "B" | "C" | "D";

export type GradeThresholds = {
  A: number;
  B: number;
  C: number;
};

export type InterviewQuestion = {
  id: string;
  text: string;
  recommendedSeconds?: number;
};

export type EvaluationDimension = {
  id: string;
  label: string;
  description?: string;
  weight: number;
  instructions: string;
  criteria: [string, string, string, string, string, string, string, string, string, string];
};

export type InterviewMode = {
  id: string;
  title: string;
  description: string;
  questions: InterviewQuestion[];
  dimensions: EvaluationDimension[];
  gradeThresholds: GradeThresholds;
  feedbackInstructions: string;
};
