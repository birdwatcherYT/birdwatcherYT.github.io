
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

        generator = await pipeline(
            'text-generation',
            'onnx-community/gemma-3-1b-it-ONNX-GQA',
            {
                dtype: 'q8',
                progress_callback: (progress) => {
                    const percentage = Math.round(progress.progress);
                    postStatus(`モデル読み込み中... (${percentage}%)`);
                }
            }
        );

    } catch (e) {
        self.postMessage({ type: 'error', text: e.message });
        console.error(e);
        generator = null;
    }
}

// メインスレッドからのメッセージを受信したときの処理
self.onmessage = async (event) => {
    const message = event.data;

    if (message.type === 'generate') {
        try {
            if (!generator) {
                await initializeModel();
                if (!generator) return; // 初期化失敗時は中断
            }

            postStatus('テキストを生成中です...');

            // メインスレッドから会話履歴の配列を受け取る
            const messages = message.prompt;

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
            self.postMessage({ type: 'complete' });
        }
    }
};