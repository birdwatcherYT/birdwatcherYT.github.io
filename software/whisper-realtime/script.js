// --- DOM Elements ---
// HTMLから操作対象の要素を取得
const output = document.getElementById("output");
const startButton = document.getElementById("start");
const stopButton = document.getElementById("stop");
const saveButton = document.getElementById("save");
const copyButton = document.getElementById("copy");
const clearButton = document.getElementById("clear");
const forceSendButton = document.getElementById("force-send");
const forceClearButton = document.getElementById("force-clear");
const cancelJobsButton = document.getElementById("cancel-jobs");
const languageSelect = document.getElementById("language-select");
const modelSelect = document.getElementById("model-select");
const separatorSelect = document.getElementById("separatorSelect");
const statusDiv = document.getElementById("status");
const vadMeterBar = document.getElementById("vad-meter-bar");
const vadThresholdMarker = document.getElementById("vad-threshold-marker");
const hangoverSlider = document.getElementById("hangover-slider");
const hangoverValue = document.getElementById("hangover-value");
const thresholdSlider = document.getElementById("threshold-slider");
const thresholdValue = document.getElementById("threshold-value");
const minSpeechSlider = document.getElementById("min-speech-slider");
const minSpeechValue = document.getElementById("min-speech-value");
const noRepeatNgramSizeInput = document.getElementById("no-repeat-ngram-size");
const logprobThresholdInput = document.getElementById("logprob-threshold");
const compressionRatioThresholdInput = document.getElementById("compression-ratio-threshold");

// --- State Management ---
// アプリケーションの状態を管理する変数群
let audioContext, stream, sourceNode, analyserNode, scriptNode;
let worker; // Workerは再生成するため、letで宣言
let isRecording = false;      // 録音中かどうかのフラグ
let isModelReady = false;     // モデルが使用可能かどうかのフラグ
let isSpeaking = false;       // 現在発話中かどうかのフラグ (VADによる判定)
let audioBuffer = [];         // 発話中の音声を保持するバッファ
let preBuffer = [];           // 発話開始前の音声を保持するバッファ (発話の冒頭が切れるのを防ぐ)
let silenceDetectionTimer = null; // VADループのためのタイマー
let lastSpeechTime = 0;       // 最後に音声を検出した時刻
let firstSpeechTime = 0;      // 最初に音声を検出した時刻 (ノイズ除去用)
let transcriptionJobsCount = 0; // 実行中の文字起こし処理の数

// --- VAD & Whisper Parameters ---
// VAD (音声区間検出) とWhisperに関する設定値
let VAD_SILENCE_THRESHOLD = parseInt(thresholdSlider.value, 10); // 無音と判断する音声レベルの閾値
let VAD_HANGOVER_MS = parseInt(hangoverSlider.value, 10);        // 発話終了後、無音と判断するまでの猶予時間
let MIN_SPEECH_DURATION_MS = parseInt(minSpeechSlider.value, 10); // 最短の発話時間 (これより短い音声はノイズとみなす)
const VAD_FFT_SIZE = 512;          // 音声分析のためのFFTサイズ
const VAD_BUFFER_SIZE = 2048;      // onaudioprocessイベントで処理するバッファサイズ
const TARGET_SAMPLE_RATE = 16000;  // Whisperが要求するサンプルレート

// --- Worker Setup ---
// Web Workerを初期化し、メッセージハンドラを設定する
const setupWorker = () => {
    worker = new Worker('./worker.js', { type: 'module' });
    worker.onmessage = (event) => {
        const { type, data } = event.data;
        switch (type) {
            case 'STATUS_UPDATE': // Workerからのステータス更新
                statusDiv.textContent = data;
                break;
            case 'MODEL_READY': // モデルの準備完了
                isModelReady = true;
                updateButtonStates();
                updateStatus();
                break;
            case 'TRANSCRIPTION_COMPLETE': // 文字起こし完了
                if (transcriptionJobsCount > 0) {
                    transcriptionJobsCount--;
                }
                if (data && data.trim()) {
                    output.textContent += data.trim() + getSeparator();
                    output.scrollTop = output.scrollHeight; // 自動スクロール
                }
                updateStatus();
                updateButtonStates();
                break;
            case 'ERROR': // Workerでエラーが発生
                statusDiv.textContent = `エラー: ${data}`;
                transcriptionJobsCount = 0;
                if (isRecording) stopRecognition();
                updateButtonStates();
                break;
        }
    };
};

// 選択された区切り文字を返す
const getSeparator = () => ({
    'newline': '\n', 'space': ' ', 'kuten': '。', 'touten': '、'
})[separatorSelect.value] || '\n';

// 現在の状態に応じてステータスメッセージを更新する
const updateStatus = () => {
    if (!isModelReady) {
        statusDiv.textContent = `モデルを準備中...`;
    } else if (transcriptionJobsCount > 0) {
        statusDiv.textContent = `文字起こし実行中... (処理中: ${transcriptionJobsCount} 件)`;
    } else if (isRecording) {
        statusDiv.textContent = 'マイクに向かって話してください。';
    } else {
        statusDiv.textContent = '準備完了。開始ボタンを押してください。';
    }
};

// UI上のボタンの有効/無効状態を更新する
const updateButtonStates = () => {
    startButton.disabled = isModelReady ? isRecording : true;
    stopButton.disabled = !isRecording;
    forceSendButton.disabled = !isSpeaking; // 発話中のみ有効
    forceClearButton.disabled = !isRecording; // 録音中のみ有効
    cancelJobsButton.disabled = transcriptionJobsCount === 0; // 処理中のジョブがある場合のみ有効
};

// Workerにモデルの初期化を指示する
const loadModel = () => {
    isModelReady = false;
    updateButtonStates();
    updateStatus();
    worker.postMessage({ type: 'INIT', model: modelSelect.value });
};

// 文字起こしを開始する
const startRecognition = () => {
    if (!isModelReady || isRecording) return;
    initializeMicrophone();
};

// マイクへのアクセスと音声処理のセットアップを行う
const initializeMicrophone = async () => {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: TARGET_SAMPLE_RATE });
        if (audioContext.state === 'suspended') await audioContext.resume();
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        sourceNode = audioContext.createMediaStreamSource(stream);
        analyserNode = audioContext.createAnalyser();
        analyserNode.fftSize = VAD_FFT_SIZE;
        const bufferLength = analyserNode.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        scriptNode = audioContext.createScriptProcessor(VAD_BUFFER_SIZE, 1, 1);

        scriptNode.onaudioprocess = (event) => {
            const inputData = event.inputBuffer.getChannelData(0);
            if (isSpeaking) {
                audioBuffer.push(...inputData);
            } else {
                preBuffer.push(...inputData);
                const maxPreBufferSize = TARGET_SAMPLE_RATE * 1.0;
                if (preBuffer.length > maxPreBufferSize) {
                    preBuffer.splice(0, preBuffer.length - maxPreBufferSize);
                }
            }
        };

        sourceNode.connect(analyserNode);
        sourceNode.connect(scriptNode);
        scriptNode.connect(audioContext.destination);

        isRecording = true;
        updateStatus();
        updateButtonStates();
        runVADDetectionLoop(dataArray, bufferLength);
    } catch (err) {
        console.error("マイクアクセスエラー:", err);
        statusDiv.textContent = 'マイクへのアクセスが許可されていません。';
        if (isRecording) stopRecognition();
    }
};

// VAD (音声区間検出) を実行するメインループ
const runVADDetectionLoop = (dataArray, bufferLength) => {
    analyserNode.getByteFrequencyData(dataArray);
    const avg = dataArray.reduce((acc, val) => acc + val, 0) / bufferLength;

    const meterPercent = Math.min(100, (avg / 128) * 100 * 2);
    vadMeterBar.style.width = `${meterPercent}%`;

    const currentTime = Date.now();

    if (avg > VAD_SILENCE_THRESHOLD) {
        if (firstSpeechTime === 0) firstSpeechTime = currentTime;
        lastSpeechTime = currentTime;

        if (!isSpeaking && (currentTime - firstSpeechTime) > MIN_SPEECH_DURATION_MS) {
            isSpeaking = true;
            audioBuffer.push(...preBuffer);
            preBuffer = [];
            updateButtonStates(); // 発話開始時にボタン状態を更新
        }
    } else if (isSpeaking) {
        if (currentTime - lastSpeechTime > VAD_HANGOVER_MS) {
            processAndSendAudio();
        }
    } else if (firstSpeechTime !== 0) {
        clearAudioBufferAndState();
    }

    if (isRecording) {
        silenceDetectionTimer = requestAnimationFrame(() => runVADDetectionLoop(dataArray, bufferLength));
    }
};

// 文字起こしを停止し、リソースを解放する
const stopRecognition = () => {
    if (!isRecording) return;
    isRecording = false;

    if (silenceDetectionTimer) cancelAnimationFrame(silenceDetectionTimer);
    if (stream) stream.getTracks().forEach(track => track.stop());
    if (scriptNode) scriptNode.disconnect();
    if (analyserNode) analyserNode.disconnect();
    if (sourceNode) sourceNode.disconnect();
    if (audioContext) audioContext.close().catch(console.error);

    stream = scriptNode = analyserNode = sourceNode = audioContext = null;
    clearAudioBufferAndState(); // バッファと状態をクリア

    updateStatus();
    updateButtonStates();
    vadMeterBar.style.width = '0%';
};

// 現在の音声バッファを文字起こしに送信し、状態をリセットする
const processAndSendAudio = () => {
    if (audioBuffer.length > 0) {
        const audioToSend = new Float32Array(audioBuffer);
        transcriptionJobsCount++;
        updateStatus();
        updateButtonStates();
        worker.postMessage({
            type: 'TRANSCRIBE',
            audio: audioToSend,
            language: languageSelect.value,
            no_repeat_ngram_size: parseInt(noRepeatNgramSizeInput.value),
            logprob_threshold: parseFloat(logprobThresholdInput.value),
            compression_ratio_threshold: parseFloat(compressionRatioThresholdInput.value)
        });
    }
    clearAudioBufferAndState();
};

// 音声バッファとVAD関連の状態をクリアする
const clearAudioBufferAndState = () => {
    audioBuffer = [];
    preBuffer = [];
    isSpeaking = false;
    firstSpeechTime = 0;
    lastSpeechTime = 0;
    updateButtonStates();
};

// 実行中のジョブをすべてキャンセルする
const cancelAllJobs = () => {
    if (transcriptionJobsCount === 0) return;

    console.log('すべての文字起こしジョブをキャンセルします...');
    worker.terminate(); // 現在のWorkerを強制終了

    transcriptionJobsCount = 0;
    statusDiv.textContent = '全処理をキャンセルしました。モデルを再初期化します...';

    setupWorker(); // 新しいWorkerインスタンスを作成して準備
    loadModel();   // モデルを再度読み込む
};

// モデル選択が変更されたときの処理
const handleModelChange = () => {
    if (isRecording) stopRecognition();
    loadModel();
};

// --- UIイベントハンドラ ---
const updateHangoverTime = () => { VAD_HANGOVER_MS = parseInt(hangoverSlider.value, 10); hangoverValue.textContent = `${VAD_HANGOVER_MS} ms`; };
const updateThreshold = () => { VAD_SILENCE_THRESHOLD = parseInt(thresholdSlider.value, 10); thresholdValue.textContent = VAD_SILENCE_THRESHOLD; const thresholdPercent = (VAD_SILENCE_THRESHOLD / 128) * 100 * 2; vadThresholdMarker.style.left = `${thresholdPercent}%`; };
const updateMinSpeechTime = () => { MIN_SPEECH_DURATION_MS = parseInt(minSpeechSlider.value, 10); minSpeechValue.textContent = `${MIN_SPEECH_DURATION_MS} ms`; };

// アプリケーションの初期化処理
const initialize = () => {
    startButton.onclick = startRecognition;
    stopButton.onclick = stopRecognition;
    forceSendButton.onclick = processAndSendAudio;
    forceClearButton.onclick = clearAudioBufferAndState;
    cancelJobsButton.onclick = cancelAllJobs;
    modelSelect.onchange = handleModelChange;
    hangoverSlider.oninput = updateHangoverTime;
    thresholdSlider.oninput = updateThreshold;
    minSpeechSlider.oninput = updateMinSpeechTime;

    saveButton.onclick = () => {
        const blob = new Blob([output.textContent], { type: "text/plain;charset=utf-8" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "transcript.txt";
        link.click();
        URL.revokeObjectURL(link.href);
    };

    copyButton.onclick = () => {
        navigator.clipboard.writeText(output.textContent).then(() => {
            const originalText = copyButton.textContent;
            copyButton.textContent = "✅ コピー完了";
            copyButton.disabled = true;
            setTimeout(() => { copyButton.textContent = originalText; copyButton.disabled = false; }, 2000);
        }).catch(err => { console.error('コピーに失敗しました: ', err); });
    };

    clearButton.onclick = () => { output.textContent = ""; };

    updateHangoverTime();
    updateThreshold();
    updateMinSpeechTime();

    setupWorker(); // 最初のWorkerをセットアップ
    loadModel();   // 初期モデルのロードを開始
};

// 初期化関数を実行
initialize();