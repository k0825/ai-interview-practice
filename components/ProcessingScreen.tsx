export function ProcessingScreen({ phase }: { phase: "transcribing" | "evaluating" }) {
  return (
    <div className="processing" role="status" aria-live="polite">
      <div className="processing-orbit"><span /><span /><span /></div>
      <div className="eyebrow">ANALYZING YOUR ANSWER</div>
      <h1>回答を確認しています</h1>
      <p>{phase === "transcribing" ? "音声を文字に起こしています" : "評価項目ごとに採点しています"}</p>
      <div className="phase-track"><span className={phase === "transcribing" ? "active" : "done"}>文字起こし</span><i /><span className={phase === "evaluating" ? "active" : ""}>採点</span></div>
    </div>
  );
}
