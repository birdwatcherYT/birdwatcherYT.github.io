// worker.js (Web Worker)

import { pipeline, TextStreamer } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2/dist/transformers.min.js";

// メインスレッドにメッセージを送信するヘルパー関数
function postStatus(text) {
    self.postMessage({ type: 'status', text });
}

let generator = null;

// モデルを非同期で初期化する関数
async function initializeModel() {
    try {
        postStatus('モデルを読み込んでいます... (初回のみ)');

        // テキスト生成パイプラインを初期化
        generator = await pipeline(
            'text-generation',
            'onnx-community/gemma-3-1b-it-ONNX-GQA',
            {
                dtype: 'q8',
                // モデルのダウンロード進捗をコールバックでメインスレッドに送信
                progress_callback: (progress) => {
                    const percentage = Math.round(progress.progress);
                    postStatus(`モデル読み込み中... (${percentage}%)`);
                }
            }
        );
        // モデル初期化完了のメッセージはここでは送らず、生成直前に送る

    } catch (e) {
        self.postMessage({ type: 'error', text: e.message });
        console.error(e);
        generator = null; // 失敗した場合はgeneratorをnullに戻す
    }
}

// メインスレッドからのメッセージを受信したときの処理
self.onmessage = async (event) => {
    const message = event.data;

    if (message.type === 'generate') {
        try {
            // モデルがまだ初期化されていない場合（初回生成時）、初期化処理を呼び出す
            if (!generator) {
                await initializeModel();
                // 初期化に失敗した場合はここで処理を中断
                if (!generator) return;
            }

            // テキスト生成が始まることを明確に通知
            postStatus('テキストを生成中です...');

            const messages = [
                { role: "user", content: message.prompt }
            ];

            // ストリーマーを作成し、生成されたトークンをメインスレッドに送信
            const streamer = new TextStreamer(generator.tokenizer, {
                skip_prompt: true,
                callback_function: (text) => {
                    self.postMessage({ type: 'stream', text });
                },
            });

            // メインスレッドから渡されたパラメータを使用してテキスト生成を実行
            await generator(messages, {
                max_new_tokens: message.max_new_tokens,
                temperature: message.temperature,
                do_sample: true,
                streamer,
            });

        } catch (e) {
            self.postMessage({ type: 'error', text: e.message });
            console.error(e);
        } finally {
            // 生成完了をメインスレッドに通知
            self.postMessage({ type: 'complete' });
        }
    }
};