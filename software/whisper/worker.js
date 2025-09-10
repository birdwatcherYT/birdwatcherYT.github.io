// worker.js

// WhisperTextStreamerをインポート
import { pipeline, WhisperTextStreamer, env } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2/dist/transformers.min.js";

env.allowLocalModels = false;
env.useBrowserCache = true;

// パイプラインのインスタンスを管理するクラス
class MyTranscriptionPipeline {
    static task = 'automatic-speech-recognition';
    static instance = null;
    static model = null;

    static async getInstance(model, progress_callback = null) {
        if (this.instance === null || this.model !== model) {
            this.model = model;
            postMessageToMain({ type: 'STATUS_UPDATE', data: `モデル「${model}」の準備を開始...` });
            this.instance = await pipeline(this.task, this.model, {
                progress_callback,
            });
        }
        return this.instance;
    }
}


self.onmessage = async (event) => {
    const {
        audio, model, language,
        chunkLength, strideLength,
        returnTimestamps, noRepeatNgramSize,
        logprobThreshold, compressionRatioThreshold,
    } = event.data;

    try {
        // 管理クラスからパイプラインのインスタンスを取得
        const transcriber = await MyTranscriptionPipeline.getInstance(model, (progress) => {
            postMessageToMain({ type: 'STATUS_UPDATE', data: `モデル読み込み中: ${progress.file} (${Math.round(progress.progress)}%)` });
        });

        postMessageToMain({ type: 'STATUS_UPDATE', data: '書き起こし中...' });

        const streamer = new WhisperTextStreamer(transcriber.tokenizer, {
            callback_function: (text) => {
                console.log("text", text);
                postMessageToMain({ type: 'TEXT', data: text });
            },
            // タイムスタンプトークン（<|0.50|>など）を検出すると呼び出される (開始時)
            on_chunk_start: (startTime) => {
                console.log("start", startTime);
                postMessageToMain({ type: 'START_TIME', data: startTime });
            },
            // タイムスタンプトークンを検出すると呼び出される (終了時)
            on_chunk_end: (endTime) => {
                console.log("end", endTime);
                postMessageToMain({ type: 'END_TIME', data: endTime });
            }
        });

        // 書き起こしを実行
        const output = await transcriber(audio, {
            // 長い音声を処理するためのチャンク設定
            chunk_length_s: chunkLength,
            stride_length_s: strideLength,

            streamer: streamer, // 作成したストリーマーを渡す
            language: language,
            // NOTE: タイムスタンプonにしないと最初のチャンクが消滅するためTRUEにする
            return_timestamps: true,

            // その他のオプション
            no_repeat_ngram_size: noRepeatNgramSize,
            logprob_threshold: logprobThreshold,
            compression_ratio_threshold: compressionRatioThreshold,
        });

        // 最終的な結果を送信（COMPLETEメッセージは全てのチャンクが処理された後の完全な出力を持ちます）
        postMessageToMain({ type: 'COMPLETE', data: output });

    } catch (error) {
        postMessageToMain({ type: 'ERROR', data: error.message });
    }
};

// メインスレッドにメッセージを送信するヘルパー関数
function postMessageToMain(message) {
    self.postMessage(message);
}