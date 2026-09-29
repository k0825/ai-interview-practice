import type { EvaluationResult } from "@/types/interview";

export function ScoreHero({ evaluation }: { evaluation: EvaluationResult }) {
  return (
    <section className="score-hero" aria-label="総合結果">
      <span className="score-kicker">OVERALL SCORE</span>
      <div className="score-line"><span className="grade">{evaluation.grade}</span><span className="score-number">{evaluation.overallScore}<small>/100</small></span></div>
      <p>今の回答の伝わりやすさ</p>
    </section>
  );
}
