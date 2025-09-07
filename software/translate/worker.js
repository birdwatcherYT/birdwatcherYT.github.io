// Transformers.jsライブラリから pipeline 関数とenv変数をインポート
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

// Web Worker環境での設定
env.allowLocalModels = false;
env.useBrowserCache = true;

// 翻訳パイプラインのインスタンスを保持する変数
let translator = null;

/**
 * モデルを初期化し、準備ができたらメインスレッドに通知する
 */
async function initializeModel() {
    try {
        translator = await pipeline('translation', 'Xenova/nllb-200-distilled-600M', {
            // 進捗状況をメインスレッドに通知するコールバック
            progress_callback: (progress) => {
                self.postMessage({
                    type: 'download',
                    data: progress
                });
            }
        });

        // 初期化完了を通知
        self.postMessage({ type: 'init_done' });

    } catch (error) {
        self.postMessage({
            type: 'error',
            message: 'モデルの初期化に失敗しました: ' + error.message
        });
    }
}

/**
 * テキストを翻訳し、結果をメインスレッドに送信する
 * @param {string} text 翻訳するテキスト
 * @param {string} source_lang ソース言語のコード
 * @param {string} lang ターゲット言語のコード
 */
async function translate(text, source_lang, lang) {
    if (!translator) {
        self.postMessage({
            type: 'error',
            message: '翻訳モデルがまだ準備できていません。'
        });
        return;
    }
    try {
        const result = await translator(text, {
            src_lang: source_lang, // 引数で受け取ったソース言語を使用
            tgt_lang: lang
        });

        // 翻訳結果をメインスレッドに送信
        self.postMessage({
            type: 'translation_result',
            data: result[0].translation_text
        });
    } catch (error) {
        self.postMessage({
            type: 'error',
            message: '翻訳中にエラーが発生しました: ' + error.message
        });
    }
}

// メインスレッドからのメッセージを受け取るリスナー
self.onmessage = (event) => {
    const { type, data } = event.data;

    // メッセージのタイプに応じて処理を振り分ける
    if (type === 'init') {
        initializeModel();
    } else if (type === 'translate') {
        translate(data.text, data.source_lang, data.lang);
    }
};