// script.js (メインスレッド)

// --- HTML要素の取得 ---
const promptInput = document.getElementById('prompt-input');
const generateButton = document.getElementById('generate-button');
const chatContainer = document.getElementById('chat-container');
const status = document.getElementById('status');
const micButton = document.getElementById('mic-button');
const modelSelect = document.getElementById('model-select');
const systemPromptInput = document.getElementById('system-prompt-input');

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
let currentRawResponse = ''; // <think>タグなどを含む生の応答
let assistantMessageElement = null;
let thinkMessageElement = null; // <think>タグの内容を表示する要素
let speechBuffer = '';
let speechProcessedLength = 0; // TTSで処理済みの文字数を追跡
let isGenerating = false;

// --- Web Worker とモデルの状態管理 ---
let worker = null;
let isModelReady = false;
let pendingGenerationRequest = null; // モデルロード中に待機させるリクエスト


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


// --- 音声読み上げ (TTS) 関連の関数 (変更なし) ---

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

function processSpeechQueue() {
    if (speechQueue.length === 0) {
        if (!isGenerating && !isSpeaking) {
            startRecognition();
        }
        return;
    }
    if (isSpeaking || !enableSpeechCheckbox.checked) {
        return;
    }
    stopRecognition();
    isSpeaking = true;
    const textToSpeak = speechQueue.shift();
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    const selectedOptionName = voiceSelect.selectedOptions[0]?.getAttribute('data-name');
    const selectedVoice = voices.find(voice => voice.name === selectedOptionName);
    if (selectedVoice) utterance.voice = selectedVoice;
    const onSpeechEnd = () => {
        isSpeaking = false;
        processSpeechQueue();
    };
    utterance.onend = onSpeechEnd;
    utterance.onerror = (event) => {
        console.error('SpeechSynthesisUtterance.onerror', event);
        status.textContent = `読み上げエラー: ${event.error}`;
        onSpeechEnd();
    };
    synth.speak(utterance);
}

function addToSpeechQueue(text) {
    if (!text.trim()) return;
    speechQueue.push(text);
    processSpeechQueue();
}

// --- メインの処理 ---

/**
 * Workerからのメッセージを処理するハンドラ
 */
function setupWorkerMessageHandler() {
    if (!worker) return;
    worker.onmessage = (event) => {
        const message = event.data;
        switch (message.type) {
            case 'status':
                status.textContent = message.text;
                const isReady = message.text.includes('準備ができました');
                if (isReady) {
                    isModelReady = true;
                    if (pendingGenerationRequest) {
                        status.textContent = '処理を開始します...';
                        worker.postMessage({
                            type: 'generate',
                            ...pendingGenerationRequest
                        });
                        pendingGenerationRequest = null;
                    } else {
                        generateButton.disabled = false;
                        promptInput.disabled = false;
                        modelSelect.disabled = false;
                    }
                }
                break;
            case 'stream':
                currentRawResponse += message.text;
                
                // <think>タグを解析
                const match = currentRawResponse.match(/^(\s*)<think>([\s\S]*?)<\/think>([\s\S]*)/);
                const openingMatch = currentRawResponse.match(/^(\s*)<think>([\s\S]*)/);

                let thinkContent = '';
                let normalContent = '';
                let hasThinkBlock = false;

                if (match) { // 開始タグと終了タグが揃っている場合
                    hasThinkBlock = true;
                    thinkContent = match[2];  // <think>の内側の内容
                    normalContent = match[3]; // </think>より後の内容
                } else if (openingMatch) { // 開始タグのみ見つかっている場合
                    hasThinkBlock = true;
                    thinkContent = openingMatch[2]; // <think>より後の内容
                    normalContent = '';
                } else { // <think>タグが見つからない場合
                    normalContent = currentRawResponse;
                }

                // 思考中メッセージの表示/更新
                if (hasThinkBlock) {
                    if (!thinkMessageElement) {
                        thinkMessageElement = displayThinkMessage('');
                    }
                    thinkMessageElement.querySelector('.think-content').textContent = thinkContent;
                }
                
                const cleanNormalContent = normalContent.trimStart();

                if (cleanNormalContent) {
                    if (!assistantMessageElement) {
                        assistantMessageElement = displayMessage('assistant', '');
                    }
                    assistantMessageElement.textContent = cleanNormalContent;
                }
                
                chatContainer.scrollTop = chatContainer.scrollHeight;
                
                if (cleanNormalContent.length > speechProcessedLength) {
                    const newTextForSpeech = cleanNormalContent.substring(speechProcessedLength);
                    speechBuffer += newTextForSpeech;
                    speechProcessedLength = cleanNormalContent.length;
                    
                    const sentences = speechBuffer.split(/(?<=[。、！？\n.,])/);
                    if (sentences.length > 1) {
                        const completeSentences = sentences.slice(0, -1).join('');
                        addToSpeechQueue(completeSentences);
                        speechBuffer = sentences[sentences.length - 1];
                    }
                }
                break;
            case 'complete':
                isGenerating = false;
                if (speechBuffer.trim()) {
                    addToSpeechQueue(speechBuffer);
                    speechBuffer = '';
                }
                
                const finalResponse = currentRawResponse.replace(/^(\s*)<think>[\s\S]*?<\/think>/, '').trim();
                if (finalResponse) {
                    conversationHistory.push({ role: 'assistant', content: finalResponse });
                }
                
                currentRawResponse = '';
                assistantMessageElement = null;
                thinkMessageElement = null;
                
                status.textContent = '準備完了。次のメッセージを入力できます。';
                generateButton.disabled = false;
                promptInput.disabled = false;
                modelSelect.disabled = false;
                promptInput.focus();
                if (!enableSpeechCheckbox.checked) {
                    startRecognition();
                } else {
                    processSpeechQueue();
                }
                break;
            case 'error':
                isGenerating = false;
                isModelReady = false; 
                displayMessage('assistant', `エラーが発生しました: ${message.text}`);
                status.textContent = 'エラーが発生しました。ページを再読み込みするか、再度送信してください。';
                generateButton.disabled = false;
                promptInput.disabled = false;
                modelSelect.disabled = false;
                speechBuffer = '';
                currentRawResponse = '';
                speechQueue = [];
                isSpeaking = false;
                synth.cancel();
                startRecognition();
                break;
        }
    };
}


function displayMessage(role, text) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', `${role}-message`);
    messageDiv.textContent = text;
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return messageDiv;
}

function displayThinkMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', 'think-message');
    
    const header = document.createElement('div');
    header.classList.add('think-header');
    header.textContent = '🧠思考中...';
    
    const content = document.createElement('div');
    content.classList.add('think-content');
    content.textContent = text;

    messageDiv.appendChild(header);
    messageDiv.appendChild(content);

    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return messageDiv;
}


async function sendMessage() {
    const userInput = promptInput.value.trim();
    if (!userInput || isGenerating) return;

    isGenerating = true;

    conversationHistory.push({ role: 'user', content: userInput });
    displayMessage('user', userInput);
    promptInput.value = '';

    if (isRecording) stopRecognition();
    speechQueue = [];
    isSpeaking = false;
    if (synth.speaking) synth.cancel();
    speechBuffer = '';
    speechProcessedLength = 0;

    generateButton.disabled = true;
    promptInput.disabled = true;
    modelSelect.disabled = true;

    const messagesForWorker = [...conversationHistory];
    const systemPrompt = systemPromptInput.value.trim();
    if (systemPrompt) {
        messagesForWorker.unshift({ role: 'system', content: systemPrompt });
    }

    const generationRequest = {
        prompt: messagesForWorker,
        max_new_tokens: parseInt(maxNewTokensInput.value, 10),
        temperature: parseFloat(temperatureInput.value),
    };

    if (!isModelReady) {
        status.textContent = 'モデルの初期化を開始します...（初回のみ時間がかかります）';
        pendingGenerationRequest = generationRequest;

        if (worker) {
            worker.terminate();
        }
        worker = new Worker('worker.js', { type: 'module' });
        setupWorkerMessageHandler();

        worker.postMessage({
            type: 'load_model',
            modelId: modelSelect.value
        });
    } else {
        status.textContent = '処理を開始します...';
        currentRawResponse = '';
        assistantMessageElement = null;
        thinkMessageElement = null;
        worker.postMessage({
            type: 'generate',
            ...generationRequest
        });
    }
}

// --- イベントリスナーの設定 ---
generateButton.addEventListener('click', sendMessage);
promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

modelSelect.addEventListener('change', () => {
    isModelReady = false;
    chatContainer.innerHTML = '';
    conversationHistory = [];
    const selectedModelText = modelSelect.options[modelSelect.selectedIndex].text;
    status.textContent = `モデルを「${selectedModelText}」に切り替えました。次にメッセージを送信すると読み込みが始まります。`;
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