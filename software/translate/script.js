// DOM要素の取得
const status = document.getElementById('status');
const input = document.getElementById('input-text');
const output = document.getElementById('output');
const translateButton = document.getElementById('translate-button');
const sourceLangSelect = document.getElementById('source-lang');
const targetLangSelect = document.getElementById('target-lang');
const swapButton = document.getElementById('swap-button');
const modelSelect = document.getElementById('model-select'); // モデル選択のセレクトボックス

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
            modelSelect.disabled = false; // モデル選択を有効化
            break;

        case 'translation_result':
            // 翻訳結果を表示
            output.textContent = data;
            setStatus('翻訳が完了しました。');
            translateButton.disabled = false; // ボタンを再度有効化
            modelSelect.disabled = false; // モデル選択を有効化
            break;

        case 'error':
            // エラーメッセージを表示
            setStatus(message);
            console.error(message);
            translateButton.disabled = false; // エラー時もボタンを有効化
            modelSelect.disabled = false; // モデル選択を有効化
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

    // --- モデルに応じた言語コードを取得 ---
    const selectedModel = modelSelect.value;
    let sourceLangCode, targetLangCode;

    if (selectedModel.includes('m2m100')) {
        // M2M100モデルの場合、data-m2m-code属性からコードを取得
        sourceLangCode = sourceLangSelect.options[sourceLangSelect.selectedIndex].getAttribute('data-m2m-code');
        targetLangCode = targetLangSelect.options[targetLangSelect.selectedIndex].getAttribute('data-m2m-code');
    } else {
        // NLLBモデル（デフォルト）の場合、value属性をそのまま使用
        sourceLangCode = sourceLangSelect.value;
        targetLangCode = targetLangSelect.value;
    }
    // --- ここまでが追加されたロジック ---


    // UIを処理中状態に更新
    translateButton.disabled = true;
    modelSelect.disabled = true; // モデル選択を無効化
    setStatus('翻訳処理をバックグラウンドに依頼しました...');
    output.textContent = '';

    // Web Workerに翻訳処理を依頼（取得した正しい言語コードを使用）
    worker.postMessage({
        type: 'translate',
        data: {
            text: textToTranslate,
            source_lang: sourceLangCode,
            lang: targetLangCode
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

// モデル選択の変更イベント
modelSelect.addEventListener('change', () => {
    // UIをモデル準備中状態に更新
    setStatus(`新しいモデル (${modelSelect.options[modelSelect.selectedIndex].text}) を準備しています...`);
    translateButton.disabled = true;
    modelSelect.disabled = true;
    output.textContent = ''; // 翻訳結果をクリア

    // Web Workerに新しいモデルでの初期化を依頼
    worker.postMessage({
        type: 'init',
        data: {
            model: modelSelect.value
        }
    });
});


// --- アプリケーションの初期化 ---
const initializeApp = () => {
    setStatus('バックグラウンドで翻訳モデルの準備をしています...');
    translateButton.disabled = true;
    modelSelect.disabled = true;

    // Web Workerに選択されているモデルでの初期化を依頼
    worker.postMessage({
        type: 'init',
        data: {
            model: modelSelect.value
        }
    });
};

// 初期化を実行
initializeApp();