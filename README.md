# Speakly — AI面接練習 PoC

ブラウザで約1分の回答を録音し、Cloudflare Workers AIで文字起こし、TypeSafeのJev APIで採点します。点数を先に表示し、ローカルのCodex SDKで生成した講評を後から追加します。履歴、利用者アカウント、DBはありません。

## 技術構成と処理フロー

- Next.js App Router / React / TypeScript（Node.js 20.9以上）
- ブラウザのMediaRecorder。対応順にWebM/Opus、WebM、MP4、Ogg/Opusを選択
- POST /api/transcribe → Cloudflare Workers AI @cf/openai/whisper-large-v3-turbo
- POST /api/evaluate → TypeSafe Jev の /v1/systemone
- Jevの結果表示後、POST /api/feedback → @openai/codex-sdk

Cloudflareへは音声をBase64にしてJSONで送り、task = transcribe、language = jaを指定します。MediaRecorderが出力するWebM/MP4/Oggの実際の受理状況は、利用するブラウザとCloudflareアカウントで確認してください。

Jevの各項目は0〜9の値を保持します。画面の項目点は10点刻みに丸め、総合点は丸め前の値を0〜100に正規化してモードの重みで加算します。A/B/Cの閾値はモードごとに定義し、Dはそれ未満です。

## セットアップ

1. npm install
2. cp .env.local.example .env.local
3. .env.local に下記の環境変数を入力
4. codex login status で Logged in using ChatGPT を確認。未ログインなら codex login
5. npm run dev で起動し、http://localhost:3000 を開く

| 環境変数 | 用途 |
| --- | --- |
| CLOUDFLARE_ACCOUNT_ID | Cloudflare Workers AIを利用できるアカウントID |
| CLOUDFLARE_API_TOKEN | Workers AIを実行できるAPIトークン |
| TYPESAFE_API_KEY | TypeSafeのダッシュボードで取得したAPIキー |

Codex SDKはサーバー側で動作し、同じローカル環境のCodex CLIのChatGPTログインを利用します。OpenAI APIキーは設定しません。サーバーを起動するOSユーザーからもログイン状態が見える必要があります。講評生成は読み取り専用のサンドボックスで実行し、採点は変更しません。

TypeSafeのダッシュボードでAPIキーを作成し、jev-latest が利用できることを確認してください。CloudflareではWorkers AIを有効にし、REST API用トークンとアカウントIDを取得してください。

## 外出先からの一時利用

1. `npm run build`
2. `npm run start -- --hostname localhost`
3. ngrokにログインし、`ngrok config add-authtoken` で認証トークンを設定
4. `ngrok http 3000` で公開HTTPS URLを取得

Basic認証はありません。URLを知る人は画面とAPIを利用でき、文字起こし・採点・講評の利用量が発生します。ngrokの無料プランでは割り当てられた開発用ドメインを使えます。Mac、アプリ、ngrokエージェントの稼働中にアクセスできます。

## モードの追加

lib/interview-modes/ に InterviewMode を満たす設定ファイルを作り、index.ts の配列へ登録します。質問は複数設定できます。各評価項目は一意のID、0〜9の10件のルーブリック、正の重みが必要で、重みの合計は1です。API、採点処理、結果UIはモード設定を参照するため変更不要です。

初期モードはガクチカ、志望動機、自己PRです。志望動機では企業情報を入力しないため、企業固有の事実の真偽は判定せず、回答がその企業を選ぶ理由として具体的かを評価します。

## 開発確認

npm run typecheck、npm run lint、npm run build で確認できます。質問画面の「テキスト回答で試す」からSTTを省いてJevとCodexの流れを試せます。Jevの採点にはTypeSafeのAPIキーが必要です。

## 現時点の制約

- 音声・回答履歴を保存しません。ページ再読み込みで結果は失われます。
- 講評の生成に失敗してもJevの点数は残り、再試行できます。
- 音声の最大長は2分、ファイル上限は12MiBです。
- ChatGPTログインを利用するCodex SDKはローカルPoC向けです。公開サービスにする場合は利用者認証、実行分離、コスト管理、レート制限、データ保護、構造化ログと観測性を設計し直してください。
- STT精度やJevのルーブリック妥当性は、日本語の実録音と代表的な回答群で追加検証が必要です。

## 確認した公式資料

- [Next.js App Routerの導入](https://nextjs.org/docs/app/getting-started/installation)
- [Cloudflare Whisper Large v3 Turbo](https://developers.cloudflare.com/workers-ai/models/whisper-large-v3-turbo/)
- [Cloudflare Workers AI REST API](https://developers.cloudflare.com/workers-ai/get-started/rest-api/)
- [TypeSafe Jev Quick Start](https://docs.typesafe.ai/introduction/quickstart)
- [OpenAI Codex SDK](https://learn.chatgpt.com/docs/codex-sdk)
- [OpenAIの認証方式](https://learn.chatgpt.com/docs/auth)
