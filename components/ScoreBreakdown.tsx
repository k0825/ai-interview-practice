import type { InterviewMode } from "@/lib/interview-modes/types";
import type { EvaluationResult } from "@/types/interview";

export function ScoreBreakdown({ mode, evaluation }: { mode: InterviewMode; evaluation: EvaluationResult }) {
  return (
    <section className="result-card" aria-labelledby="breakdown-title">
      <div className="card-heading"><div><span className="eyebrow">SCORE DETAILS</span><h2 id="breakdown-title">項目別スコア</h2></div><span className="card-count">{mode.dimensions.length}項目</span></div>
      <div className="score-list">
        {mode.dimensions.map((dimension) => {
          const score = evaluation.scores[dimension.id];
          return <div className="score-row" key={dimension.id}>
            <div className="score-row-head"><span>{dimension.label}</span><strong>{score.displayScore}<small>点</small></strong></div>
            <div className="bar-track"><span style={{ width: `${score.displayScore}%` }} /></div>
          </div>;
        })}
      </div>
    </section>
  );
}
