export function TranscriptSection({ transcript }: { transcript: string }) {
  return <details className="transcript-card"><summary>あなたの回答 <span>文字起こしを見る ＋</span></summary><p>{transcript}</p></details>;
}
