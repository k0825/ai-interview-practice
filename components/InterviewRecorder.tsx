"use client";

import { useEffect, useRef, useState } from "react";
import type { InterviewQuestion } from "@/lib/interview-modes/types";

const MAX_SECONDS = 120;

function formatTime(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function InterviewRecorder({
  question,
  onAudio
}: {
  question: InterviewQuestion;
  onAudio: (audio: Blob) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef(0);
  const cancelledRef = useRef(false);

  function release() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  useEffect(() => {
    // React replays effects in development. Re-arm after that replay so a
    // later recorder.onstop is handled instead of being mistaken for unmount.
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      if (intervalRef.current) clearInterval(intervalRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function start() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("このブラウザは録音に対応していません。Chromeなどの対応ブラウザでお試しください。");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus"
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      const chunks: BlobPart[] = [];
      let failed = false;
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onerror = () => {
        failed = true;
        setError("録音中にエラーが発生しました。もう一度お試しください。");
        release();
        setRecording(false);
      };
      recorder.onstop = () => {
        release();
        if (cancelledRef.current || failed) return;
        setRecording(false);
        if (Date.now() - startedAtRef.current < 2000) {
          setError("2秒以上話してから回答を終了してください。");
          return;
        }
        const audio = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        if (!audio.size) {
          setError("音声が記録されませんでした。もう一度お試しください。");
          return;
        }
        onAudio(audio);
      };
      startedAtRef.current = Date.now();
      setElapsed(0);
      recorder.start(250);
      setRecording(true);
      intervalRef.current = setInterval(() => {
        const seconds = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setElapsed(seconds);
        if (seconds >= MAX_SECONDS && recorder.state === "recording") recorder.stop();
      }, 250);
    } catch (cause) {
      release();
      setError(cause instanceof DOMException && cause.name === "NotAllowedError"
        ? "マイクの使用が許可されていません。ブラウザの設定を確認してください。"
        : "マイクを開始できませんでした。接続とブラウザの設定を確認してください。");
    }
  }

  function stop() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  return (
    <div className="recorder-panel">
      <div className="question-label">YOUR QUESTION</div>
      <h1>{question.text}</h1>
      <p className="question-help">目安は{question.recommendedSeconds ?? 60}秒。話し言葉で、あなた自身の経験を伝えてください。</p>
      <div className={recording ? "recording-indicator is-recording" : "recording-indicator"}>
        <span className="recording-dot" aria-hidden="true" />
        <span>{recording ? "回答中" : "準備ができたら始めましょう"}</span>
      </div>
      <div className="timer" aria-live="off">{formatTime(elapsed)}</div>
      <p className="time-hint">{recording ? "最大2分で自動終了します" : "マイクの使用を許可してください"}</p>
      {recording
        ? <button className="primary-button stop-button" type="button" onClick={stop}>回答を終了する <span>■</span></button>
        : <button className="primary-button" type="button" onClick={start}>回答を開始する <span>→</span></button>}
      {error && <p className="inline-error" role="alert">{error}</p>}
    </div>
  );
}
