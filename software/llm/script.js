// script.js (メインスレッド)

// HTML要素の取得
const promptInput = document.getElementById('prompt-input');
const generateButton = document.getElementById('generate-button');
const resultContainer = document.getElementById('result-container');
const status = document.getElementById('status');

// パラメータUI要素の取得
const maxNewTokensRange = document.getElementById('max-new-tokens-range');
const maxNewTokensInput = document.getElementById('max-new-tokens-input');
const temperatureRange = document.getElementById('temperature-range');
const temperatureInput = document.getElementById('temperature-input');

// ページの読み込み時にWeb Workerを初期化
const worker = new Worker('worker.js', { type: 'module' });

// Workerからのメッセージを受信したときの処理
worker.onmessage = (event) => {
    const message = event.data;

    switch (message.type) {
        case 'status':
            // Workerから送られてくる現在の状況を表示
            status.textContent = message.text;
            // 処理中はボタンを無効化
            if (message.text.includes('準備ができました') || message.text.includes('入力できます')) {
                generateButton.disabled = false;
            } else {
                generateButton.disabled = true;
            }
            break;

        case 'stream':
            // ストリーミングされたテキストを追記
            resultContainer.textContent += message.text;
            break;

        case 'complete':
            // 生成完了時のメッセージを調整
            status.textContent = '準備完了。次のメッセージを入力できます。';
            generateButton.disabled = false;
            break;

        case 'error':
            // エラー発生
            resultContainer.textContent = `エラーが発生しました: ${message.text}`;
            status.textContent = 'エラーが発生しました';
            generateButton.disabled = false;
            break;
    }
};

// 生成ボタンがクリックされたときの処理
generateButton.addEventListener('click', async () => {
    const userInput = promptInput.value;
    if (!userInput) {
        alert('メッセージを入力してください。');
        return;
    }

    // 即時フィードバックとしてステータスを設定（すぐにWorkerからのメッセージで上書きされる）
    status.textContent = '処理を開始します...';
    generateButton.disabled = true;
    resultContainer.textContent = ''; // 前回の結果をクリア

    // UIからパラメータを取得
    const max_new_tokens = parseInt(maxNewTokensInput.value, 10);
    const temperature = parseFloat(temperatureInput.value);

    // Workerにプロンプトとパラメータを送信して生成を依頼
    worker.postMessage({
        type: 'generate',
        prompt: userInput,
        max_new_tokens: max_new_tokens,
        temperature: temperature,
    });
});

// パラメータのスライダーと数値入力を同期させる
maxNewTokensRange.addEventListener('input', (e) => {
    maxNewTokensInput.value = e.target.value;
});
maxNewTokensInput.addEventListener('input', (e) => {
    maxNewTokensRange.value = e.target.value;
});
temperatureRange.addEventListener('input', (e) => {
    temperatureInput.value = e.target.value;
});
temperatureInput.addEventListener('input', (e) => {
    temperatureRange.value = e.target.value;
});


// 初期状態のUI設定メッセージを調整
status.textContent = 'メッセージを入力して「テキストを生成」を押してください。';
generateButton.disabled = false;