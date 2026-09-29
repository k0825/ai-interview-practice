import type { InterviewMode } from "@/lib/interview-modes/types";

export function ModeSelector({
  modes,
  onSelect
}: {
  modes: InterviewMode[];
  onSelect: (mode: InterviewMode) => void;
}) {
  return (
    <section className="selection" aria-labelledby="selection-title">
      <div className="eyebrow">INTERVIEW PRACTICE</div>
      <h1 id="selection-title">声に出すと、<br /><span>伝わり方が変わる。</span></h1>
      <p className="lead">1分の回答から、あなたの強みと次の一歩を見つけましょう。</p>
      <div className="section-heading">
        <span className="step-number">01</span>
        <div><h2>何を練習しますか？</h2><p>取り組みたいテーマを選んでください</p></div>
      </div>
      <div className="mode-list">
        {modes.map((mode, index) => (
          <button type="button" className="mode-card" key={mode.id} onClick={() => onSelect(mode)}>
            <span className="mode-index">0{index + 1}</span>
            <span className="mode-copy"><strong>{mode.title}</strong><small>{mode.description}</small></span>
            <span className="arrow" aria-hidden="true">↗</span>
          </button>
        ))}
      </div>
      <p className="privacy-note">録音は採点のために送信されます。履歴は保存しません。</p>
    </section>
  );
}
