// ===== HTML要素の取得 =====
const video = document.getElementById('camera');
const hiddenCanvas = document.getElementById('hidden-canvas');
const shutterBtn = document.getElementById('shutter-btn');
const recordBtn = document.getElementById('record-btn'); // 統合されたボタン
const resolutionSelect = document.getElementById('resolution-select');
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


// ===== カメラの初期化・再初期化 =====
async function initCamera() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
    }
    const selectedValue = resolutionSelect.value;
    const [width, height] = selectedValue.split('x').map(Number);
    video.width = width;
    video.height = height;
    hiddenCanvas.width = width;
    hiddenCanvas.height = height;
    const constraints = { video: { width: { exact: width }, height: { exact: height } }, audio: true };
    try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
        currentStream = stream;
    } catch (err) {
        console.error("カメラエラー:", err);
        alert(`解像度 (${width}x${height}) はサポートされていません。`);
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
        modalDownloadLink.download = `photo-${index}.png`;
    } else {
        modalImage.style.display = 'none';
        modalVideo.style.display = 'block';
        modalVideo.src = item.data;
        modalDownloadLink.href = item.data;
        modalDownloadLink.download = `video-${index}.webm`;
    }
    modal.style.display = 'block';
}
function closeModal() {
    modal.style.display = 'none';
    modalVideo.pause();
}


// ===== 写真撮影の処理 =====
shutterBtn.addEventListener('click', () => {
    const context = hiddenCanvas.getContext('2d');
    context.drawImage(video, 0, 0, hiddenCanvas.width, hiddenCanvas.height);
    const dataUrl = hiddenCanvas.toDataURL('image/png');
    galleryItems.push({ type: 'photo', data: dataUrl, thumbnail: dataUrl });
    renderGallery();
});


// ===== 動画撮影のトグル処理 =====
recordBtn.addEventListener('click', () => {
    // 録画中でなければ、録画を開始
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        startRecording();
    }
    // 録画中であれば、録画を停止
    else {
        stopRecording();
    }
});

function startRecording() {
    recordedChunks = [];
    if (!currentStream) {
        alert("カメラストリームが見つかりません。");
        return;
    }

    mediaRecorder = new MediaRecorder(currentStream, { mimeType: 'video/webm' });
    mediaRecorder.ondataavailable = e => (e.data.size > 0) && recordedChunks.push(e.data);
    mediaRecorder.onstop = async () => {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const blobUrl = URL.createObjectURL(blob);
        const thumbnail = await createVideoThumbnail(blobUrl);
        galleryItems.push({ type: 'video', data: blobUrl, thumbnail: thumbnail });
        renderGallery();
    };

    mediaRecorder.start();

    // UIを録画中状態に更新
    recordBtn.textContent = '録画停止';
    recordBtn.classList.add('is-recording');
    shutterBtn.disabled = true;
    resolutionSelect.disabled = true;
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();

        // UIを非録画状態に更新
        recordBtn.textContent = '録画開始';
        recordBtn.classList.remove('is-recording');
        shutterBtn.disabled = false;
        resolutionSelect.disabled = false;
    }
}


// ===== ヘルパー関数とクリア処理 =====
function createVideoThumbnail(videoUrl) {
    return new Promise(resolve => {
        const tempVideo = document.createElement('video');
        tempVideo.src = videoUrl;
        tempVideo.muted = true;
        tempVideo.addEventListener('loadeddata', () => {
            setTimeout(() => { tempVideo.currentTime = 0; }, 200);
        }, { once: true });
        tempVideo.addEventListener('seeked', () => {
            const context = hiddenCanvas.getContext('2d');
            context.drawImage(tempVideo, 0, 0, hiddenCanvas.width, hiddenCanvas.height);
            const dataUrl = hiddenCanvas.toDataURL('image/jpeg');
            resolve(dataUrl);
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
closeModalBtn.addEventListener('click', closeModal);
window.addEventListener('click', (event) => {
    if (event.target === modal) {
        closeModal();
    }
});


// ===== アプリケーションの初期化 =====
initCamera();