"use client";

import { useRef, useState } from "react";
import { ModeSelector } from "@/components/ModeSelector";
import { InterviewRecorder } from "@/components/InterviewRecorder";
import { ProcessingScreen } from "@/components/ProcessingScreen";
import { ScoreHero } from "@/components/ScoreHero";
import { ScoreBreakdown } from "@/components/ScoreBreakdown";
import { FeedbackSection } from "@/components/FeedbackSection";
import { TranscriptSection } from "@/components/TranscriptSection";
import { interviewModes } from "@/lib/interview-modes";
import type { InterviewMode, InterviewQuestion } from "@/lib/interview-modes/types";
import type { EvaluationResult, InterviewFeedback } from "@/types/interview";

type Step = "mode-selection" | "question" | "processing" | "result";
type Phase = "transcribing" | "evaluating";

const sampleAnswers: Record<string, string> = {
  gakuchika: "大学時代、焼肉店のアルバイトで新人教育の改善に取り組みました。教える人によって内容が異なっていたため、私は最初の2週間で覚えるべき業務のチェックリストを作成しました。その結果、一人で基本業務を担当できるまでの期間を平均3週間から約2週間に短縮できました。この経験から、課題を整理して仕組みに落とし込む大切さを学びました。",
  motivation: "私は、現場の課題を見つけて仕組みで改善する仕事に取り組みたいと考え、御社を志望しました。アルバイトでは新人教育のばらつきを減らすチェックリストを作り、習得期間を短縮しました。御社の具体的な事業や業務を調べた上で、同じように課題を整理し、周囲と協力して改善に貢献したいです。",
  "self-pr": "私の強みは、課題を整理して仕組みに変える力です。焼肉店のアルバイトでは新人ごとに教える内容が違うことに気づき、最初の2週間で覚える業務をチェックリストにまとめました。その結果、一人で基本業務を担当できるまでの期間が平均3週間から約2週間になりました。仕事でも、状況を観察し、周囲が使える改善策に落とし込みたいです。"
};

async function postJson<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "処理に失敗しました。");
  return data as T;
}

function errorMessage(cause: unknown, fallback: string) {
  if (cause instanceof DOMException && cause.name === "TimeoutError") {
    return "処理がタイムアウトしました。もう一度お試しください。";
  }
  return cause instanceof Error ? cause.message : fallback;
}

export default function Home() {
  const [step, setStep] = useState<Step>("mode-selection");
  const [mode, setMode] = useState<InterviewMode | null>(null);
  const [question, setQuestion] = useState<InterviewQuestion | null>(null);
  const [phase, setPhase] = useState<Phase>("transcribing");
  const [transcript, setTranscript] = useState("");
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [feedback, setFeedback] = useState<InterviewFeedback | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");
  const [error, setError] = useState("");
  const [sampleText, setSampleText] = useState(sampleAnswers.gakuchika);
  const runRef = useRef(0);

  function reset() {
    runRef.current += 1;
    setMode(null);
    setQuestion(null);
    setTranscript("");
    setEvaluation(null);
    setFeedback(null);
    setFeedbackError("");
    setError("");
    setStep("mode-selection");
  }

  function chooseMode(selected: InterviewMode) {
    setMode(selected);
    setQuestion(selected.questions[0]);
    setSampleText(sampleAnswers[selected.id] || "");
    setError("");
    setStep("question");
  }

  async function requestFeedback(
    currentMode: InterviewMode,
    currentQuestion: InterviewQuestion,
    currentTranscript: string,
    currentEvaluation: EvaluationResult,
    runId: number
  ) {
    setFeedbackLoading(true);
    setFeedbackError("");
    try {
      const data = await postJson<InterviewFeedback>("/api/feedback", {
        modeId: currentMode.id,
        questionId: currentQuestion.id,
        transcript: currentTranscript,
        evaluation: currentEvaluation
      }, 100000);
      if (runRef.current === runId) setFeedback(data);
    } catch (cause) {
      if (runRef.current === runId) {
        setFeedbackError(errorMessage(cause, "詳しいフィードバックの生成に失敗しました。"));
      }
    } finally {
      if (runRef.current === runId) setFeedbackLoading(false);
    }
  }

  async function evaluateTranscript(currentTranscript: string, currentMode: InterviewMode, currentQuestion: InterviewQuestion, runId: number) {
    setPhase("evaluating");
    const result = await postJson<EvaluationResult>("/api/evaluate", {
      modeId: currentMode.id,
      questionId: currentQuestion.id,
      transcript: currentTranscript
    }, 25000);
    if (runRef.current !== runId) return;
    setEvaluation(result);
    setStep("result");
    void requestFeedback(currentMode, currentQuestion, currentTranscript, result, runId);
  }

  async function handleAudio(blob: Blob) {
    if (!mode || !question) return;
    const runId = ++runRef.current;
    setError("");
    setPhase("transcribing");
    setStep("processing");
    try {
      const form = new FormData();
      const extension = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
      form.append("audio", blob, `answer.${extension}`);
      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(65000)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "文字起こしに失敗しました。");
      if (!data.transcript?.trim()) throw new Error("回答を読み取れませんでした。もう一度お試しください。");
      if (runRef.current !== runId) return;
      setTranscript(data.transcript);
      await evaluateTranscript(data.transcript, mode, question, runId);
    } catch (cause) {
      if (runRef.current !== runId) return;
      setError(errorMessage(cause, "処理に失敗しました。"));
      setStep("question");
    }
  }

  async function handleSample() {
    if (!mode || !question || !sampleText.trim()) return;
    const runId = ++runRef.current;
    setError("");
    setTranscript(sampleText.trim());
    setStep("processing");
    try {
      await evaluateTranscript(sampleText.trim(), mode, question, runId);
    } catch (cause) {
      if (runRef.current !== runId) return;
      setError(errorMessage(cause, "採点に失敗しました。"));
      setStep("question");
    }
  }

  return (
    <div className="app-shell">
      <header className="site-header"><button type="button" className="brand" onClick={reset} aria-label="最初の画面に戻る"><span className="brand-mark">S<span>.</span></span><span>Speakly</span></button><span className="header-tag">AI INTERVIEW PRACTICE</span></header>
      <main className="main-content">
        {step === "mode-selection" && <ModeSelector modes={interviewModes} onSelect={chooseMode} />}
        {mode && question && step !== "mode-selection" && <>
          <nav className="breadcrumbs" aria-label="進行状況"><span>{mode.title}</span><span className="breadcrumb-line" /><span>{step === "question" ? "回答する" : step === "processing" ? "採点中" : "結果"}</span></nav>
          {step === "question" && <>
            <button className="text-button" type="button" onClick={reset}>← テーマを選び直す</button>
            {mode.questions.length > 1 && <div className="question-options"><label htmlFor="question-select">質問を選ぶ</label><select id="question-select" value={question.id} onChange={(event) => setQuestion(mode.questions.find((item) => item.id === event.target.value) || mode.questions[0])}>{mode.questions.map((item) => <option key={item.id} value={item.id}>{item.text}</option>)}</select></div>}
            <InterviewRecorder question={question} onAudio={handleAudio} />
            {error && <div className="page-error" role="alert">{error}</div>}
            <details className="dev-sample"><summary>テキスト回答で試す</summary><textarea aria-label="テスト回答" value={sampleText} onChange={(event) => setSampleText(event.target.value)} /><button type="button" onClick={handleSample} disabled={!sampleText.trim()}>この回答を採点する →</button></details>
          </>}
          {step === "processing" && <ProcessingScreen phase={phase} />}
          {step === "result" && evaluation && <div className="results">
            <div className="results-intro"><div><span className="eyebrow">YOUR RESULT</span><h1>{mode.title}の採点結果</h1></div><button className="text-button" type="button" onClick={reset}>別のテーマに進む ↗</button></div>
            <ScoreHero evaluation={evaluation} />
            <ScoreBreakdown mode={mode} evaluation={evaluation} />
            <FeedbackSection feedback={feedback} loading={feedbackLoading} error={feedbackError} onRetry={() => void requestFeedback(mode, question, transcript, evaluation, runRef.current)} />
            <TranscriptSection transcript={transcript} />
            <button type="button" className="secondary-button" onClick={() => { runRef.current += 1; setFeedback(null); setEvaluation(null); setTranscript(""); setError(""); setStep("question"); }}>同じ質問でもう一度練習する →</button>
          </div>}
        </>}
      </main>
      <footer className="site-footer"><span>Speakly · Interview practice</span><span>一歩ずつ、伝わる回答へ。</span></footer>
    </div>
  );
}
