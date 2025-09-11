// worker.js (Web Worker)

import { pipeline, TextStreamer } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2/dist/transformers.min.js";

// メインスレッドにメッセージを送信するヘルパー関数
function postStatus(text) {
    self.postMessage({ type: 'status', text });
}

let generator = null; // このWorkerインスタンスのジェネレーター

// モデルを非同期で初期化する関数
async function initializeModel(modelId) {
    try {
        postStatus(`モデル「${modelId}」を読み込んでいます...`);

        generator = await pipeline(
            'text-generation',
            modelId,
            {
                dtype: 'q8', // 量子化タイプ (多くのモデルでサポート)
                progress_callback: (progress) => {
                    const percentage = Math.round(progress.progress);
                    postStatus(`モデル読み込み中... (${percentage}%)`);
                }
            }
        );
        postStatus('準備ができました。メッセージを入力できます。');
    } catch (e) {
        self.postMessage({ type: 'error', text: e.message });
        console.error(e);
        generator = null;
    }
}

// メインスレッドからのメッセージを受信したときの処理
self.onmessage = async (event) => {
    const message = event.data;

    switch (message.type) {
        case 'load_model':
            // Worker起動時にメインスレッドから一度だけ呼ばれる
            // 新しいモデルの初期化を開始
            await initializeModel(message.modelId);
            break;

        case 'generate':
            // テキスト生成要求
            if (!generator) {
                // モデルの初期化がまだ完了していないか、失敗した場合
                self.postMessage({ type: 'error', text: 'モデルが初期化されていません。ページを再読み込みするか、モデルを再選択してください。' });
                return;
            }

            try {
                postStatus('テキストを生成中です...');

                const messages = message.prompt;
                const streamer = new TextStreamer(generator.tokenizer, {
                    skip_prompt: true,
                    callback_function: (text) => {
                        self.postMessage({ type: 'stream', text });
                    },
                });

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
            break;
    }
};