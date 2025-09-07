// DOM要素の取得
const status = document.getElementById('status');
const input = document.getElementById('input-text');
const output = document.getElementById('output');
const translateButton = document.getElementById('translate-button');
const sourceLangSelect = document.getElementById('source-lang');
const targetLangSelect = document.getElementById('target-lang');
const swapButton = document.getElementById('swap-button'); // スワップボタン

// UIの状態を更新する関数
const setStatus = (text) => {
    status.textContent = text;
};

// --- Web Workerのセットアップ ---
const worker = new Worker('./worker.js', { type: 'module' });

// Workerからのメッセージを処理するリスナー
worker.onmessage = (event) => {
    const { type, data, message } = event.data;

    switch (type) {
        case 'download':
            // モデルのダウンロード進捗を表示
            if (data.status === 'progress') {
                const percentage = data.progress.toFixed(2);
                setStatus(`モデルをダウンロード中... ${percentage}%`);
            } else {
                setStatus(`モデルの準備中... (${data.status})`);
            }
            break;

        case 'init_done':
            // モデルの準備完了
            setStatus('翻訳の準備が完了しました。');
            translateButton.disabled = false;
            break;

        case 'translation_result':
            // 翻訳結果を表示
            output.textContent = data;
            setStatus('翻訳が完了しました。');
            translateButton.disabled = false; // ボタンを再度有効化
            break;

        case 'error':
            // エラーメッセージを表示
            setStatus(message);
            console.error(message);
            translateButton.disabled = false; // エラー時もボタンを有効化
            break;
    }
};

// 翻訳ボタンのクリックイベント
translateButton.addEventListener('click', () => {
    const textToTranslate = input.value.trim();
    if (!textToTranslate) {
        output.textContent = '翻訳するテキストを入力してください。';
        return;
    }

    // 翻訳元と翻訳先が同じ場合は処理しない
    if (sourceLangSelect.value === targetLangSelect.value) {
        output.textContent = '翻訳元と翻訳先の言語が同じです。';
        return;
    }

    // UIを処理中状態に更新
    translateButton.disabled = true;
    setStatus('翻訳処理をバックグラウンドに依頼しました...');
    output.textContent = '';

    // Web Workerに翻訳処理を依頼
    worker.postMessage({
        type: 'translate',
        data: {
            text: textToTranslate,
            source_lang: sourceLangSelect.value,
            lang: targetLangSelect.value
        }
    });
});

// スワップボタンのクリックイベント
swapButton.addEventListener('click', () => {
    // 選択されている値を取得
    const sourceLang = sourceLangSelect.value;
    const targetLang = targetLangSelect.value;

    // 値を入れ替える
    sourceLangSelect.value = targetLang;
    targetLangSelect.value = sourceLang;
});


// --- アプリケーションの初期化 ---
setStatus('バックグラウンドで翻訳モデルの準備をしています...');
translateButton.disabled = true;

// Web Workerにモデルの初期化を依頼
worker.postMessage({
    type: 'init'
});