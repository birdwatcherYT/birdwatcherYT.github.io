// script.js (メインスレッド)

// --- HTML要素の取得 ---
const promptInput = document.getElementById('prompt-input');
const generateButton = document.getElementById('generate-button');
const chatContainer = document.getElementById('chat-container');
const status = document.getElementById('status');
const micButton = document.getElementById('mic-button');

// パラメータUI要素
const maxNewTokensRange = document.getElementById('max-new-tokens-range');
const maxNewTokensInput = document.getElementById('max-new-tokens-input');
const temperatureRange = document.getElementById('temperature-range');
const temperatureInput = document.getElementById('temperature-input');

// --- Speech Synthesis (音声読み上げ) 関連 ---
const enableSpeechCheckbox = document.getElementById('enable-speech-checkbox');
const voiceSelect = document.getElementById('voice-select');
const synth = window.speechSynthesis;
let voices = [];
let selectedVoiceName = null;
let speechQueue = [];
let isSpeaking = false;

// --- Speech Recognition (音声認識) 関連 ---
const recognitionLanguageSelect = document.getElementById('recognition-language-select');
const autoSendCheckbox = document.getElementById('auto-send-checkbox');
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isRecording = false;
let isMicActive = false;
let finalTranscript = '';

// --- チャットの状態管理 ---
let conversationHistory = [];
let currentAssistantResponse = '';
let assistantMessageElement = null;
let speechBuffer = '';
let isGenerating = false;

// --- Web Worker の初期化 ---
const worker = new Worker('worker.js', { type: 'module' });


// --- 音声認識 (ASR) 関連の関数 (変更なし) ---

function startRecognition() {
    if (!isMicActive || isSpeaking || isRecording) return;
    if (!SpeechRecognition) {
        alert("このブラウザは音声認識をサポートしていません。");
        isMicActive = false;
        micButton.classList.remove('mic-recording', 'mic-waiting');
        micButton.textContent = '🎤';
        return;
    }
    isRecording = true;
    micButton.classList.remove('mic-waiting');
    micButton.classList.add('mic-recording');
    status.textContent = '音声認識中...';
    finalTranscript = promptInput.value;
    if (finalTranscript && !finalTranscript.endsWith(' ')) {
        finalTranscript += ' ';
    }
    recognition = new SpeechRecognition();
    recognition.lang = recognitionLanguageSelect.value;
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.onresult = (event) => {
        let interimTranscript = '';
        let newFinalText = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript;
                newFinalText += transcript;
            } else {
                interimTranscript += transcript;
            }
        }
        promptInput.value = finalTranscript + interimTranscript;
        if (autoSendCheckbox.checked && newFinalText.trim() !== '') {
            sendMessage();
            finalTranscript = '';
        }
    };
    recognition.onend = () => {
        isRecording = false;
        if (isMicActive) {
            micButton.classList.remove('mic-recording');
            micButton.classList.add('mic-waiting');
        }
    };
    recognition.onerror = (event) => {
        console.error('音声認識エラー:', event.error);
        if (event.error !== 'no-speech') {
            status.textContent = `音声認識エラー: ${event.error}`;
        }
    };
    recognition.start();
}

function stopRecognition() {
    if (!isRecording || !recognition) return;
    recognition.onend = null;
    recognition.stop();
    isRecording = false;
    micButton.classList.remove('mic-recording');
    if (isMicActive) {
        micButton.classList.add('mic-waiting');
    }
    status.textContent = 'メッセージを入力して「送信」ボタンを押してください。';
}

micButton.addEventListener('click', () => {
    isMicActive = !isMicActive;
    if (isMicActive) {
        micButton.textContent = '■';
        startRecognition();
    } else {
        micButton.classList.remove('mic-recording', 'mic-waiting');
        micButton.textContent = '🎤';
        stopRecognition();
    }
});


// --- 音声読み上げ (TTS) 関連の関数 ---

function populateVoiceList() {
    voices = synth.getVoices();
    const previouslySelected = selectedVoiceName || voiceSelect.selectedOptions[0]?.getAttribute('data-name');
    voiceSelect.innerHTML = '';
    const groupedVoices = voices.reduce((groups, voice) => {
        const lang = voice.lang;
        if (!groups[lang]) groups[lang] = [];
        groups[lang].push(voice);
        return groups;
    }, {});
    Object.keys(groupedVoices).sort().forEach(lang => {
        const optgroup = document.createElement('optgroup');
        optgroup.label = lang;
        groupedVoices[lang].forEach(voice => {
            const option = document.createElement('option');
            option.textContent = `${voice.name} (${voice.lang})`;
            option.setAttribute('data-name', voice.name);
            optgroup.appendChild(option);
        });
        voiceSelect.appendChild(optgroup);
    });
    let targetVoiceName = previouslySelected;
    if (!targetVoiceName) {
        const japaneseVoice = voices.find(voice => voice.lang === 'ja-JP');
        if (japaneseVoice) targetVoiceName = japaneseVoice.name;
    }
    if (targetVoiceName) {
        for (let i = 0; i < voiceSelect.options.length; i++) {
            if (voiceSelect.options[i].getAttribute('data-name') === targetVoiceName) {
                voiceSelect.selectedIndex = i;
                selectedVoiceName = targetVoiceName;
                break;
            }
        }
    }
}

/**
 * 音声読み上げキューを処理する
 */
function processSpeechQueue() {
    // 条件1: キューが空か？ -> もし空なら、生成完了しているかチェックして認識再開
    if (speechQueue.length === 0) {
        // AIの生成も完了し、何も話していなければ、ユーザーのターンに戻す
        if (!isGenerating && !isSpeaking) {
            startRecognition();
        }
        return;
    }
    // 条件2: 既に話しているか？
    if (isSpeaking || !enableSpeechCheckbox.checked) {
        return;
    }

    // これから話すので、認識を止める
    stopRecognition();
    isSpeaking = true;
    const textToSpeak = speechQueue.shift();

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    const selectedOptionName = voiceSelect.selectedOptions[0]?.getAttribute('data-name');
    const selectedVoice = voices.find(voice => voice.name === selectedOptionName);

    if (selectedVoice) utterance.voice = selectedVoice;

    // 読み上げ完了時の処理
    const onSpeechEnd = () => {
        isSpeaking = false;
        // 次のキューアイテムの処理を試みる
        processSpeechQueue();
    };

    utterance.onend = onSpeechEnd;
    utterance.onerror = (event) => {
        console.error('SpeechSynthesisUtterance.onerror', event);
        status.textContent = `読み上げエラー: ${event.error}`;
        onSpeechEnd(); // エラーでも次の処理に進む
    };
    synth.speak(utterance);
}

function addToSpeechQueue(text) {
    if (!text.trim()) return;
    speechQueue.push(text);
    processSpeechQueue();
}

// --- メインの処理 ---

worker.onmessage = (event) => {
    const message = event.data;
    switch (message.type) {
        case 'status':
            status.textContent = message.text;
            const isReady = message.text.includes('準備ができました') || message.text.includes('入力できます');
            generateButton.disabled = !isReady;
            promptInput.disabled = !isReady;
            break;
        case 'stream':
            if (!assistantMessageElement) assistantMessageElement = displayMessage('assistant', '');
            currentAssistantResponse += message.text;
            assistantMessageElement.textContent = currentAssistantResponse;
            chatContainer.scrollTop = chatContainer.scrollHeight;
            speechBuffer += message.text;
            const sentences = speechBuffer.split(/(?<=[。、！？\n])/);
            if (sentences.length > 1) {
                const completeSentences = sentences.slice(0, -1).join('');
                addToSpeechQueue(completeSentences);
                speechBuffer = sentences[sentences.length - 1];
            }
            break;
        case 'complete':
            isGenerating = false;
            if (speechBuffer.trim()) {
                addToSpeechQueue(speechBuffer);
                speechBuffer = '';
            }
            if (currentAssistantResponse) {
                conversationHistory.push({ role: 'assistant', content: currentAssistantResponse });
            }
            currentAssistantResponse = '';
            assistantMessageElement = null;
            status.textContent = '準備完了。次のメッセージを入力できます。';
            generateButton.disabled = false;
            promptInput.disabled = false;
            promptInput.focus();

            // TTSがオフの場合の認識再開処理はそのまま
            if (!enableSpeechCheckbox.checked) {
                startRecognition();
            } else {
                // TTSがオンの場合、キューの処理を促す
                processSpeechQueue();
            }
            break;
        case 'error':
            isGenerating = false;
            displayMessage('assistant', `エラーが発生しました: ${message.text}`);
            status.textContent = 'エラーが発生しました';
            generateButton.disabled = false;
            promptInput.disabled = false;
            speechBuffer = '';
            currentAssistantResponse = '';
            speechQueue = [];
            isSpeaking = false;
            synth.cancel();
            startRecognition();
            break;
    }
};

function displayMessage(role, text) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', `${role}-message`);
    messageDiv.textContent = text;
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return messageDiv;
}

async function sendMessage() {
    const userInput = promptInput.value.trim();
    if (!userInput || generateButton.disabled) return;

    isGenerating = true;

    if (isRecording) {
        stopRecognition();
    }
    speechQueue = [];
    isSpeaking = false;
    if (synth.speaking) synth.cancel();
    speechBuffer = '';
    conversationHistory.push({ role: 'user', content: userInput });
    displayMessage('user', userInput);
    currentAssistantResponse = '';
    assistantMessageElement = null;
    status.textContent = '処理を開始します...';
    generateButton.disabled = true;
    promptInput.disabled = true;
    promptInput.value = '';
    const max_new_tokens = parseInt(maxNewTokensInput.value, 10);
    const temperature = parseFloat(temperatureInput.value);
    worker.postMessage({
        type: 'generate',
        prompt: conversationHistory,
        max_new_tokens: max_new_tokens,
        temperature: temperature,
    });
}

// --- イベントリスナーの設定 ---
generateButton.addEventListener('click', sendMessage);
promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});
maxNewTokensRange.addEventListener('input', (e) => { maxNewTokensInput.value = e.target.value; });
maxNewTokensInput.addEventListener('input', (e) => { maxNewTokensRange.value = e.target.value; });
temperatureRange.addEventListener('input', (e) => { temperatureInput.value = e.target.value; });
temperatureInput.addEventListener('input', (e) => { temperatureRange.value = e.target.value; });
voiceSelect.addEventListener('change', () => { selectedVoiceName = voiceSelect.selectedOptions[0].getAttribute('data-name'); });

// --- 初期化処理 ---
populateVoiceList();
if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = populateVoiceList;
}
status.textContent = 'メッセージを入力して「送信」ボタンを押してください。';
promptInput.disabled = false;
generateButton.disabled = false;