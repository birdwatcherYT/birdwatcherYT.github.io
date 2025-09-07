import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

// Transformers.jsの環境設定
env.allowLocalModels = false; // ローカルモデルの読み込みを無効化
env.useBrowserCache = true;   // ブラウザキャッシュを使用してモデルを高速に読み込む

// 文字起こしモデルのインスタンスを保持する変数
let transcriber = null;

// メインスレッドからのメッセージを受信するイベントリスナー
self.onmessage = async (event) => {
    // メインスレッドから渡されたデータを展開
    const {
        type, model, language, audio,
        no_repeat_ngram_size, logprob_threshold, compression_ratio_threshold,
        generation // ジョブキャンセル機能のための世代ID
    } = event.data;

    try {
        switch (type) {
            // モデル初期化のメッセージ
            case 'INIT':
                // まだモデルが読み込まれていないか、選択されたモデルが変更された場合に初期化
                if (!transcriber || transcriber.model.model_name !== model) {
                    self.postMessage({ type: 'STATUS_UPDATE', data: `モデル「${model}」の準備を開始...` });
                    // Automatic Speech Recognition (ASR) パイプラインを初期化
                    transcriber = await pipeline('automatic-speech-recognition', model, {
                        // モデルのダウンロード進捗をメインスレッドに通知
                        progress_callback: (progress) => {
                            const statusText = `モデル読込中: ${progress.file} (${Math.round(progress.progress)}%)`;
                            self.postMessage({ type: 'STATUS_UPDATE', data: statusText });
                        }
                    });
                }
                // モデルの準備完了をメインスレッドに通知
                self.postMessage({ type: 'MODEL_READY' });
                break;

            // 文字起こし実行のメッセージ
            case 'TRANSCRIBE':
                if (!transcriber) {
                    throw new Error("モデルが初期化されていません。");
                }

                // Whisperの推論オプションを指定して文字起こしを実行
                const output = await transcriber(audio, {
                    language,
                    task: 'transcribe',
                    no_repeat_ngram_size,
                    logprob_threshold,
                    compression_ratio_threshold
                });

                // 文字起こし結果と世代IDをメインスレッドに送信
                self.postMessage({ type: 'TRANSCRIPTION_COMPLETE', data: output.text, generation: generation });
                break;
        }
    } catch (error) {
        // エラーが発生した場合、メインスレッドに通知
        self.postMessage({ type: 'ERROR', data: error.message });
    }
};