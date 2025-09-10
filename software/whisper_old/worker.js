// worker.js

import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

env.allowLocalModels = false;
env.useBrowserCache = true;

let transcriber = null;

self.onmessage = async (event) => {
    const {
        audio, duration, model,
        language, chunkLength, strideLength,
        returnTimestamps,
        // 新しいパラメータを受け取る
        noRepeatNgramSize,
        logprobThreshold,
        compressionRatioThreshold,
    } = event.data;

    try {
        if (!transcriber || transcriber.model.model_name !== model) {
            postMessageToMain({ type: 'STATUS_UPDATE', data: `モデル「${model}」の準備を開始...` });
            transcriber = await pipeline('automatic-speech-recognition', model, {
                progress_callback: (progress) => {
                    postMessageToMain({ type: 'STATUS_UPDATE', data: `モデル読み込み中: ${progress.file} (${Math.round(progress.progress)}%)` });
                }
            });
        }

        const chunk_length_s = chunkLength;
        const stride_length_s = strideLength;

        const step_length_s = chunk_length_s - stride_length_s;
        if (step_length_s <= 0) {
            throw new Error('チャンク長はオーバーラップ長より大きくする必要があります。');
        }

        const totalSteps = Math.ceil(duration / step_length_s);
        let processedSteps = 0;

        postMessageToMain({ type: 'PROGRESS', data: 0 });

        const transcriberOptions = {
            language: language,
            task: 'transcribe',
            chunk_length_s: chunk_length_s,
            stride_length_s: stride_length_s,
            return_timestamps: returnTimestamps,
            // 新しいパラメータをオプションに追加
            no_repeat_ngram_size: noRepeatNgramSize,
            logprob_threshold: logprobThreshold,
            compression_ratio_threshold: compressionRatioThreshold,

            chunk_callback: (chunk) => {
                // (chunk_callbackの中身は変更なし)
                processedSteps++;
                const percentage = Math.round((processedSteps / totalSteps) * 100);
                const displayPercentage = Math.min(100, percentage);
                postMessageToMain({ type: 'PROGRESS', data: displayPercentage });

                const chunkOffset = (processedSteps - 1) * step_length_s;

                const { tokens } = chunk;
                if (transcriber && transcriber.tokenizer && tokens) {
                    let decodedText = transcriber.tokenizer.decode(tokens, { skip_special_tokens: true }).trim();

                    if (!decodedText) return;
                    console.log(decodedText);

                    let segments = [];
                    if (returnTimestamps) {
                        const regex = /<\|(\d+\.\d+)\|>(.*?)<\|(\d+\.\d+)\|>/g;
                        let match;
                        while ((match = regex.exec(decodedText)) !== null) {
                            const text = match[2].trim();
                            if (text) {
                                const startTime = parseFloat(match[1]) + chunkOffset;
                                const endTime = parseFloat(match[3]) + chunkOffset;
                                segments.push({
                                    text: text,
                                    timestamp: [startTime, endTime]
                                });
                            }
                        }
                        if (segments.length === 0) {
                            const cleanText = decodedText.replace(/<\|\d+\.\d+\|>/g, '').trim();
                            if (cleanText && chunk.timestamp) {
                                const startTime = chunk.timestamp[0] + chunkOffset;
                                const endTime = chunk.timestamp[1] + chunkOffset;
                                segments.push({ text: cleanText, timestamp: [startTime, endTime] });
                            }
                        }
                    } else {
                        segments.push({ text: decodedText, timestamp: null });
                    }

                    if (segments.length > 0) {
                        postMessageToMain({
                            type: 'CHUNK_DECODED',
                            data: segments
                        });
                    }
                }
            }
        };

        const output = await transcriber(audio, transcriberOptions);

        postMessageToMain({ type: 'COMPLETE', data: output });

    } catch (error) {
        postMessageToMain({ type: 'ERROR', data: error.message });
    }
};

function postMessageToMain(message) {
    self.postMessage(message);
}