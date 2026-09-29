import type { InterviewFeedback } from "@/types/interview";

export function FeedbackSection({
  feedback,
  loading,
  error,
  onRetry
}: {
  feedback: InterviewFeedback | null;
  loading: boolean;
  error: string;
  onRetry: () => void;
}) {
  return (
    <section className="result-card feedback-card" aria-labelledby="feedback-title">
      <div className="card-heading"><div><span className="eyebrow">PERSONAL FEEDBACK</span><h2 id="feedback-title">詳しいフィードバック</h2></div></div>
      {loading && <div className="feedback-loading" role="status"><span className="small-spinner" />詳しいフィードバックを作成しています...</div>}
      {error && !loading && <div className="feedback-error"><p>{error}</p><button type="button" onClick={onRetry}>再試行する →</button></div>}
      {feedback && <>
        <div className="feedback-group"><h3><span className="group-icon good">✓</span>良かったところ</h3>
          {feedback.strengths.map((item, index) => <div className="feedback-item" key={index}><strong>{item.title}</strong><p>{item.explanation}</p></div>)}
        </div>
        <div className="feedback-group"><h3><span className="group-icon improve">↗</span>改善ポイント</h3>
          {feedback.improvements.map((item, index) => <div className="feedback-item" key={index}><strong>{item.title}</strong><p>{item.explanation}</p><p className="suggestion">{item.suggestion}</p></div>)}
        </div>
        <div className="feedback-group"><h3><span className="group-icon answer">✦</span>改善後の回答例</h3><div className="answer-example">{feedback.improvedAnswer}</div></div>
        <div className="feedback-group"><h3><span className="group-icon question">?</span>追加で聞かれそうな質問</h3>
          <ul className="follow-up-list">{feedback.followUpQuestions.map((item, index) => <li key={index}>{item}</li>)}</ul>
        </div>
      </>}
    </section>
  );
}
