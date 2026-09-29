import { gakuchika } from "./gakuchika";
import { motivation } from "./motivation";
import { selfPr } from "./self-pr";
import type { InterviewMode } from "./types";

const configuredModes: InterviewMode[] = [gakuchika, motivation, selfPr];

function validateMode(mode: InterviewMode) {
  if (!mode.questions.length || !mode.dimensions.length) {
    throw new Error(`Mode ${mode.id} needs questions and dimensions`);
  }
  const ids = new Set<string>();
  for (const dimension of mode.dimensions) {
    if (ids.has(dimension.id) || dimension.criteria.length !== 10 || dimension.weight <= 0) {
      throw new Error(`Invalid dimension ${mode.id}/${dimension.id}`);
    }
    ids.add(dimension.id);
  }
  if (Math.abs(mode.dimensions.reduce((total, dimension) => total + dimension.weight, 0) - 1) > 0.000001) {
    throw new Error(`Weights for ${mode.id} must total 1`);
  }
  if (!(mode.gradeThresholds.A > mode.gradeThresholds.B &&
        mode.gradeThresholds.B > mode.gradeThresholds.C &&
        mode.gradeThresholds.C >= 0 &&
        mode.gradeThresholds.A <= 100)) {
    throw new Error(`Invalid grade thresholds for ${mode.id}`);
  }
}

configuredModes.forEach(validateMode);

export const interviewModes = configuredModes;

export function getMode(modeId: string): InterviewMode | undefined {
  return interviewModes.find((mode) => mode.id === modeId);
}

export function getQuestion(mode: InterviewMode, questionId: string) {
  return mode.questions.find((question) => question.id === questionId);
}

export type { InterviewMode, InterviewQuestion, EvaluationDimension, Grade } from "./types";
