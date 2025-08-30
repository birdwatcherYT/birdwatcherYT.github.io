// ===== HTML要素の取得 =====
const video = document.getElementById('camera');
const hiddenCanvas = document.getElementById('hidden-canvas');
const shutterBtn = document.getElementById('shutter-btn');
const recordBtn = document.getElementById('record-btn'); // 統合されたボタン
const resolutionSelect = document.getElementById('resolution-select');
const cameraSelect = document.getElementById('camera-select'); // カメラ選択を追加
const gallery = document.getElementById('gallery');
const clearGalleryBtn = document.getElementById('clear-gallery-btn');
const modal = document.getElementById('my-modal');
const modalImage = document.getElementById('modal-image');
const modalVideo = document.getElementById('modal-video');
const modalDownloadLink = document.getElementById('modal-download-link');
const closeModalBtn = document.querySelector('.close-btn');


// ===== 変数の定義 =====
let mediaRecorder;
let recordedChunks = [];
let currentStream;
let galleryItems = [];


// ===== カメラデバイス一覧の取得と設定 =====
async function populateCameraList() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        const currentCameraId = currentStream?.getVideoTracks()[0]?.getSettings().deviceId;

        cameraSelect.innerHTML = ''; // 以前のリストをクリア

        videoDevices.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `カメラ ${cameraSelect.length + 1}`;
            if (device.deviceId === currentCameraId) {
                option.selected = true; // 現在使用中のカメラを選択状態にする
            }
            cameraSelect.appendChild(option);
        });
    } catch (err) {
        console.error("カメラデバイスリストの取得エラー:", err);
    }
}


// ===== カメラの初期化・再初期化 =====
async function initCamera() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
    }
    const selectedValue = resolutionSelect.value;
    const [width, height] = selectedValue.split('x').map(Number);

    const constraints = {
        video: {
            width: { ideal: width },
            height: { ideal: height },
        },
        audio: true
    };

    if (cameraSelect.value) {
        constraints.video.deviceId = { exact: cameraSelect.value };
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
        currentStream = stream;

        // 実際に適用された解像度を取得し、ユーザーの選択と異なる場合は通知する
        const track = stream.getVideoTracks()[0];
        const settings = track.getSettings();

        // 少し待ってからでないと、正しい videoWidth/Height が取得できない場合がある
        video.onloadedmetadata = () => {
            if (settings.width !== width || settings.height !== height) {
                alert(`ご希望の解像度 (${width}x${height}) は利用できませんでした。\n代わりにサポートされている解像度 (${settings.width}x${settings.height}) でカメラを開始します。`);
            }
        };

        await populateCameraList();
    } catch (err) {
        console.error("カメラエラー:", err);
        alert(`解像度 (${width}x${height}) または指定のカメラはサポートされていません。`);
    }
}


// ===== ギャラリーの描画 =====
function renderGallery() {
    gallery.innerHTML = '';
    galleryItems.forEach((item, index) => {
        const thumbContainer = document.createElement('div');
        thumbContainer.classList.add('thumbnail');
        const thumbImage = document.createElement('img');
        thumbImage.src = item.thumbnail;
        thumbContainer.appendChild(thumbImage);
        if (item.type === 'video') {
            const playIcon = document.createElement('div');
            playIcon.classList.add('play-icon');
            playIcon.innerHTML = '▶';
            thumbContainer.appendChild(playIcon);
        }
        thumbContainer.addEventListener('click', () => openModal(index));
        gallery.appendChild(thumbContainer);
    });
}


// ===== モーダルの制御 =====
function openModal(index) {
    const item = galleryItems[index];
    if (item.type === 'photo') {
        modalImage.style.display = 'block';
        modalVideo.style.display = 'none';
        modalImage.src = item.data;
        modalDownloadLink.href = item.data;
        modalDownloadLink.download = `photo-${Date.now()}.png`;
    } else {
        modalImage.style.display = 'none';
        modalVideo.style.display = 'block';
        modalVideo.src = item.data;
        modalDownloadLink.href = item.data;
        modalDownloadLink.download = `video-${Date.now()}.webm`;
    }
    modal.style.display = 'block';
}
function closeModal() {
    modal.style.display = 'none';
    modalVideo.pause();
    modalVideo.src = ""; // ソースをクリア
}


// ===== 写真撮影の処理 =====
shutterBtn.addEventListener('click', () => {
    hiddenCanvas.width = video.videoWidth;
    hiddenCanvas.height = video.videoHeight;

    const context = hiddenCanvas.getContext('2d');
    context.drawImage(video, 0, 0, hiddenCanvas.width, hiddenCanvas.height);
    const dataUrl = hiddenCanvas.toDataURL('image/png');
    galleryItems.push({ type: 'photo', data: dataUrl, thumbnail: dataUrl });
    renderGallery();
});


// ===== 動画撮影のトグル処理 =====
recordBtn.addEventListener('click', () => {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        startRecording();
    } else {
        stopRecording();
    }
});

function startRecording() {
    recordedChunks = [];
    if (!currentStream) {
        alert("カメラストリームが見つかりません。");
        return;
    }

    const options = { mimeType: 'video/webm' };
    try {
        mediaRecorder = new MediaRecorder(currentStream, options);
    } catch (e) {
        console.error("MediaRecorderの初期化に失敗: ", e);
        alert("お使いのブラウザではこの形式での録画に対応していません。");
        return;
    }

    mediaRecorder.ondataavailable = e => (e.data.size > 0) && recordedChunks.push(e.data);
    mediaRecorder.onstop = async () => {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const blobUrl = URL.createObjectURL(blob);
        const thumbnail = await createVideoThumbnail(blobUrl);
        galleryItems.push({ type: 'video', data: blobUrl, thumbnail: thumbnail });
        renderGallery();
    };

    mediaRecorder.start();

    recordBtn.textContent = '録画停止';
    recordBtn.classList.add('is-recording');
    shutterBtn.disabled = true;
    resolutionSelect.disabled = true;
    cameraSelect.disabled = true;
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();

        recordBtn.textContent = '録画開始';
        recordBtn.classList.remove('is-recording');
        shutterBtn.disabled = false;
        resolutionSelect.disabled = false;
        cameraSelect.disabled = false;
    }
}


// ===== ヘルパー関数とクリア処理 =====
function createVideoThumbnail(videoUrl) {
    return new Promise(resolve => {
        const tempVideo = document.createElement('video');
        tempVideo.src = videoUrl;
        tempVideo.muted = true;

        tempVideo.addEventListener('loadeddata', () => {
            tempVideo.currentTime = 0;
        }, { once: true });

        tempVideo.addEventListener('seeked', () => {
            hiddenCanvas.width = tempVideo.videoWidth;
            hiddenCanvas.height = tempVideo.videoHeight;
            const context = hiddenCanvas.getContext('2d');
            context.drawImage(tempVideo, 0, 0, hiddenCanvas.width, hiddenCanvas.height);
            const dataUrl = hiddenCanvas.toDataURL('image/jpeg');
            resolve(dataUrl);
            tempVideo.remove();
        }, { once: true });

        tempVideo.play().catch(() => { });
    });
}

clearGalleryBtn.addEventListener('click', () => {
    galleryItems.forEach(item => {
        if (item.type === 'video') {
            URL.revokeObjectURL(item.data);
        }
    });
    galleryItems = [];
    renderGallery();
});


// ===== イベントリスナーの設定 =====
resolutionSelect.addEventListener('change', initCamera);
cameraSelect.addEventListener('change', initCamera);
closeModalBtn.addEventListener('click', closeModal);
window.addEventListener('click', (event) => {
    if (event.target === modal) {
        closeModal();
    }
});


// ===== アプリケーションの初期化 =====
initCamera();