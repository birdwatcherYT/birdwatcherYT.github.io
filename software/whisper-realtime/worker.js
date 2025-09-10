import { pipeline, WhisperTextStreamer, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2/dist/transformers.min.js';

// Transformers.jsの環境設定
env.allowLocalModels = false; // ローカルモデルの読み込みを無効化
env.useBrowserCache = true;   // ブラウザキャッシュを使用してモデルを高速に読み込む

/**
 * パイプラインのインスタンスを管理するクラス（シングルトンパターン）
 * モデルが変更された場合のみ再初期化を行う
 */
class TranscriptionPipeline {
    static task = 'automatic-speech-recognition';
    static instance = null;
    static model = null;

    static async getInstance(model, progress_callback = null) {
        // モデルが変更された場合、またはインスタンスがまだない場合に初期化
        if (this.instance === null || this.model !== model) {
            this.model = model;
            this.instance = await pipeline(this.task, this.model, {
                progress_callback,
            });
        }
        return this.instance;
    }
}

// メインスレッドからのメッセージを受信するイベントリスナー
self.onmessage = async (event) => {
    const {
        type, model, language, audio,
        no_repeat_ngram_size, logprob_threshold, compression_ratio_threshold
    } = event.data;

    try {
        switch (type) {
            case 'INIT':
                // モデルの準備を開始
                self.postMessage({ type: 'STATUS_UPDATE', data: `モデル「${model}」の準備を開始...` });
                await TranscriptionPipeline.getInstance(model, (progress) => {
                    const statusText = `モデル読込中: ${progress.file} (${Math.round(progress.progress)}%)`;
                    self.postMessage({ type: 'STATUS_UPDATE', data: statusText });
                });
                // モデル準備完了を通知
                self.postMessage({ type: 'MODEL_READY' });
                break;

            case 'TRANSCRIBE':
                // パイプラインインスタンスを取得
                const transcriber = await TranscriptionPipeline.getInstance(model);
                if (!transcriber) {
                    throw new Error("モデルが初期化されていません。");
                }

                // WhisperTextStreamerを使用して、部分的な結果をリアルタイムでコールバック
                const streamer = new WhisperTextStreamer(transcriber.tokenizer, {
                    // 部分的な文字起こし結果が生成されるたびに呼び出される
                    callback_function: (text) => {
                        self.postMessage({ type: 'PARTIAL_TRANSCRIPTION', data: text });
                    }
                });

                // 文字起こしを実行
                const output = await transcriber(audio, {
                    chunk_length_s: 30,
                    stride_length_s: 5,

                    streamer: streamer,
                    language: language,
                    // NOTE: タイムスタンプを有効にしないと、一部のストリーミング結果が欠落する場合がある
                    return_timestamps: true,
                    // その他の推論オプション
                    no_repeat_ngram_size: no_repeat_ngram_size,
                    logprob_threshold: logprob_threshold,
                    compression_ratio_threshold: compression_ratio_threshold
                });

                // 最終的な文字起こし結果をメインスレッドに送信
                self.postMessage({ type: 'TRANSCRIPTION_COMPLETE', data: output.text });
                break;
        }
    } catch (error) {
        // エラーが発生した場合、メインスレッドに通知
        self.postMessage({ type: 'ERROR', data: error.message });
    }
};
