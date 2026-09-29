import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { InterviewRecorder } from "../components/InterviewRecorder";

test("recording can finish after React StrictMode replays effects", async () => {
  const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
    url: "http://localhost:3000"
  });
  const keys = ["window", "document", "navigator", "MediaRecorder", "IS_REACT_ACT_ENVIRONMENT"] as const;
  const originals = Object.fromEntries(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const originalNow = Date.now;
  let now = 10_000;
  const received: Blob[] = [];

  class FakeMediaRecorder {
    static isTypeSupported() { return true; }
    state = "inactive";
    mimeType: string;
    ondataavailable: ((event: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    onerror: (() => void) | null = null;

    constructor(_stream: MediaStream, options?: MediaRecorderOptions) {
      this.mimeType = options?.mimeType || "audio/webm";
    }

    start() { this.state = "recording"; }
    stop() {
      this.state = "inactive";
      this.ondataavailable?.({ data: new Blob(["audio".repeat(400)], { type: this.mimeType }) });
      queueMicrotask(() => this.onstop?.());
    }
  }

  Object.defineProperty(globalThis, "window", { configurable: true, value: dom.window });
  Object.defineProperty(globalThis, "document", { configurable: true, value: dom.window.document });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: dom.window.navigator });
  Object.defineProperty(globalThis, "MediaRecorder", { configurable: true, value: FakeMediaRecorder });
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
  Object.defineProperty(dom.window.navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) }
  });
  Date.now = () => now;

  const container = dom.window.document.getElementById("root");
  assert.ok(container);
  const root = createRoot(container);
  try {
    await act(async () => {
      root.render(createElement(StrictMode, null,
        createElement(InterviewRecorder, {
          question: { id: "q", text: "質問です。" },
          onAudio: (audio: Blob) => received.push(audio)
        })
      ));
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>(".primary-button")?.click();
      await Promise.resolve();
    });
    assert.match(container.textContent || "", /回答を終了する/);

    now += 3_000;
    await act(async () => {
      container.querySelector<HTMLButtonElement>(".stop-button")?.click();
      await Promise.resolve();
    });
    assert.equal(received.length, 1);
    assert.ok(received[0].size > 0);
    assert.match(container.textContent || "", /回答を開始する/);
  } finally {
    await act(async () => root.unmount());
    Date.now = originalNow;
    for (const key of keys) {
      const descriptor = originals[key];
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
    dom.window.close();
  }
});
