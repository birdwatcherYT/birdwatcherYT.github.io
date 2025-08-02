const canvas = document.getElementById('drawCanvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const previewCanvas = document.getElementById('previewCanvas');
const previewCtx = previewCanvas.getContext('2d', { willReadFrequently: true });
const canvasContainer = document.getElementById('canvasContainer');

let drawing = false;
let history = [];
let redoStack = [];
let currentTool = 'pen'; // 現在のツール ('pen', 'marker', 'line', 'rect', 'circle', 'eraser', 'text', 'image', 'select', 'eyedropper', 'blur')
let startX, startY; // 描画開始座標
let lastX = null, lastY = null; // ペンツール用
let imageToInsert = null; // 挿入する画像オブジェクト
let selectionStartX, selectionStartY;
let selectionEndX, selectionEndY;
let clipboard = null; // コピーまたはカットされたImageDataを保存
let originalImageWidth; // 挿入する画像の元の幅
let originalImageHeight; // 挿入する画像の元の高さ
// オフスクリーンキャンバス用変数 (strokeモードで使用)
let offscreenCanvas = null;
let offscreenCtx = null;

const storageKey = "birdwatcheryt_github_io_software_paint";

// --- DOM要素取得 ---
const colorPicker = document.getElementById('colorPicker');
const sizePicker = document.getElementById('sizePicker');
const alphaPicker = document.getElementById('alphaPicker');
const penBtn = document.getElementById('penBtn');
const markerBtn = document.getElementById('markerBtn');
const lineBtn = document.getElementById('lineBtn');
const rectBtn = document.getElementById('rectBtn');
const circleBtn = document.getElementById('circleBtn');
const eraserBtn = document.getElementById('eraserBtn');
const textBtn = document.getElementById('textBtn');
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');
const clearBtn = document.getElementById('clearBtn');
const saveBtn = document.getElementById('saveBtn');
const saveFormat = document.getElementById('saveFormat');
const widthInput = document.getElementById('canvasWidth');
const heightInput = document.getElementById('canvasHeight');
const resizeBtn = document.getElementById('resizeBtn');
const uploadBtn = document.getElementById('uploadBtn');
const imageUpload = document.getElementById('imageUpload');
const imageBtn = document.getElementById('imageBtn');
const imageInsert = document.getElementById('imageInsert');
const selectBtn = document.getElementById('selectBtn');
const trimBtn = document.getElementById('trimBtn');
const copyBtn = document.getElementById('copyBtn');
const cutBtn = document.getElementById('cutBtn');
const pasteBtn = document.getElementById('pasteBtn');
const fillCheckbox = document.getElementById('fillCheckbox');
const scaleBtn = document.getElementById('scaleBtn');
const rotateBtn = document.getElementById('rotateBtn');
const flipHorizontalBtn = document.getElementById('flipHorizontalBtn');
const eyedropperBtn = document.getElementById('eyedropperBtn');
const blurBtn = document.getElementById('blurBtn'); // ぼかしボタン取得
const mosaicBtn = document.getElementById('mosaicBtn'); // モザイクボタン取得

// --- 初期化処理 ---
function initializeCanvas() {
    let initialWidth = 500; // デフォルト幅
    let initialHeight = 500; // デフォルト高さ
    let initialImageData = null;

    // 以前の状態を復元 or 初期化
    try {
        const lastStateString = localStorage.getItem(storageKey);
        if (lastStateString) {
            const lastState = JSON.parse(lastStateString); // JSONをパース
            // 保存されたデータに width と height が含まれているか確認
            if (lastState && typeof lastState === 'object' && lastState.width && lastState.height && lastState.imageData) {
                initialWidth = parseInt(lastState.width, 10);
                initialHeight = parseInt(lastState.height, 10);
                initialImageData = lastState.imageData;

            }
        }
    } catch (error) {
        console.error("LocalStorage Load/Parse Error:", error);
        // エラー発生時はLocalStorageの該当データを削除（推奨）
        localStorage.removeItem(storageKey);
    }

    // 取得したサイズまたはデフォルトサイズでキャンバスを設定
    canvas.width = initialWidth;
    canvas.height = initialHeight;
    previewCanvas.width = initialWidth;
    previewCanvas.height = initialHeight;
    widthInput.value = initialWidth;
    heightInput.value = initialHeight;

    // 画像データがあれば復元
    if (initialImageData) {
        // restoreState は画像データのみを受け取る
        restoreState({ imageData: initialImageData, width: initialWidth, height: initialHeight });
        // ローカルストレージから復元した場合、それを最初の履歴として保存
        history = [{ imageData: initialImageData, width: initialWidth, height: initialHeight }];
    } else {
        // 何もない状態を最初の履歴として保存
        ctx.clearRect(0, 0, canvas.width, canvas.height); // 念のためクリア
        history = [{ imageData: canvas.toDataURL(), width: canvas.width, height: canvas.height }]; // 新しい履歴を開始
    }

    setActiveTool('pen'); // 初期ツールを設定
    updateUndoRedoButtons(); // ボタン状態を初期化
}
// --- 状態管理 ---
function saveLocal() {
    try {
        const state = {
            imageData: canvas.toDataURL(),
            width: canvas.width,
            height: canvas.height
        };
        // JSON文字列としてLocalStorageに保存
        localStorage.setItem(storageKey, JSON.stringify(state));
    } catch (error) {
        console.error("LocalStorage Save Error:", error);
    };
}

function saveState() {
    if (history.length >= 50) history.shift();
    history.push({
        imageData: canvas.toDataURL(),
        width: canvas.width,
        height: canvas.height
    });
    redoStack = []; // 新しい操作をしたらRedo履歴はクリア
    updateUndoRedoButtons();
}

function restoreState(state) {
    const img = new Image();
    img.onload = () => {
        // キャンバスのサイズを復元
        canvas.width = state.width;
        canvas.height = state.height;
        previewCanvas.width = state.width;
        previewCanvas.height = state.height;
        widthInput.value = state.width;
        heightInput.value = state.height;

        // globalAlphaをリセット
        ctx.globalAlpha = 1.0;
        ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        // ローカルストレージにも反映
        saveLocal();
        // ボタンの状態更新
        updateUndoRedoButtons();
    };
    img.onerror = () => {
        console.error("Failed to load image for restoreState");
        // エラー時もボタン状態は更新
        updateUndoRedoButtons();
    }
    img.src = state.imageData;
}

function updateUndoRedoButtons() {
    undoBtn.disabled = history.length <= 1;
    redoBtn.disabled = redoStack.length === 0;
    pasteBtn.disabled = !clipboard;
}

// --- ツール関連 ---
function setActiveTool(toolName) {
    currentTool = toolName;

    // ボタンのハイライト処理
    const buttons = [selectBtn, penBtn, markerBtn, lineBtn, rectBtn, circleBtn, eraserBtn, textBtn, imageBtn, pasteBtn, eyedropperBtn, blurBtn];
    buttons.forEach(btn => {
        if (btn) { // ボタンが存在するか確認
            btn.classList.remove('active');
        }
    });

    const activeBtn = document.getElementById(toolName + 'Btn');
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
    if (currentTool === 'image') {
        // 画像挿入モードの場合、ファイル選択をトリガー
        imageInsert.click();
    }

    // カーソルの変更
    if (toolName === 'eraser' || toolName === 'blur') {
        canvas.style.cursor = 'cell';
    } else if (toolName === 'text') {
        canvas.style.cursor = 'text';
    } else if (toolName === 'paste' && clipboard) {
        canvas.style.cursor = 'copy';
    } else {
        canvas.style.cursor = 'crosshair';
    }
    // 選択ツールが非アクティブになったらプレビューをクリアし、関連ボタンを無効化
    if (currentTool !== 'select') {
        previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        trimBtn.disabled = true;
        copyBtn.disabled = true;
        cutBtn.disabled = true;
        mosaicBtn.disabled = true; // モザイクボタンも無効化
    }
}

// --- 描画関数 ---
function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    let rawX, rawY;

    if (e.touches && e.touches.length > 0) {
        rawX = e.touches[0].clientX - rect.left;
        rawY = e.touches[0].clientY - rect.top;
    } else if (e.changedTouches && e.changedTouches.length > 0) {
        rawX = e.changedTouches[0].clientX - rect.left;
        rawY = e.changedTouches[0].clientY - rect.top;
    } else {
        rawX = e.clientX - rect.left;
        rawY = e.clientY - rect.top;
    }

    // 選択ツールの時だけ、マウス座標をキャンバス内にクランプ（射影）する
    if (currentTool === 'select') {
        return {
            x: Math.max(0, Math.min(rawX, canvas.width)),
            y: Math.max(0, Math.min(rawY, canvas.height))
        };
    }

    // 他ツールの場合はそのままの座標を返す
    return { x: rawX, y: rawY };
}

function startPosition(e) {
    // 左クリック以外は無視
    if (e.button !== undefined && e.button !== 0) return;

    drawing = true;
    const pos = getMousePos(e);
    startX = pos.x;
    startY = pos.y;

    // mousemoveとmouseupイベントをwindowに追加して、キャンバス外でもイベントを拾う
    window.addEventListener('mousemove', draw);
    window.addEventListener('mouseup', endPosition);

    if (currentTool === 'eyedropper') {
        const pixelData = ctx.getImageData(startX, startY, 1, 1).data;
        const r = pixelData[0];
        const g = pixelData[1];
        const b = pixelData[2];
        const a = pixelData[3];
        const alphaValue = a / 255;
        const hexColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        colorPicker.value = hexColor;
        alphaPicker.value = alphaValue;
        drawing = false;
        // イベントリスナーを即座に削除
        window.removeEventListener('mousemove', draw);
        window.removeEventListener('mouseup', endPosition);
        return;
    }

    lastX = startX;
    lastY = startY;

    if (currentTool === 'select') {
        selectionStartX = startX;
        selectionStartY = startY;
    } else if (currentTool === 'pen') {
        if (!offscreenCanvas) {
            offscreenCanvas = document.createElement('canvas');
        }
        offscreenCanvas.width = canvas.width;
        offscreenCanvas.height = canvas.height;
        offscreenCtx = offscreenCanvas.getContext('2d');
        offscreenCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
        applyContextSettings(offscreenCtx);
        drawPenPoint(offscreenCtx, startX, startY);
        updatePenPreview();
    } else if (currentTool === 'marker' || currentTool === 'eraser') {
        applyContextSettings(ctx);
        drawPenPoint(ctx, startX, startY);
    } else if (currentTool === 'blur') {
        applyBlurToPoint(startX, startY);
    } else if (currentTool === 'text') {
        const text = prompt("テキストを入力してください:", "");
        if (text) {
            applyContextSettings(ctx);
            ctx.font = `${sizePicker.value * 2}px sans-serif`;
            ctx.fillText(text, startX, startY);
            saveState();
            saveLocal();
        }
        drawing = false;
        // イベントリスナーを即座に削除
        window.removeEventListener('mousemove', draw);
        window.removeEventListener('mouseup', endPosition);
    } else if (currentTool === 'paste' && clipboard) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = clipboard.width;
        tempCanvas.height = clipboard.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.putImageData(clipboard, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1.0;
        ctx.drawImage(tempCanvas, startX, startY);
        saveState();
        saveLocal();
        drawing = false;
        // イベントリスナーを即座に削除
        window.removeEventListener('mousemove', draw);
        window.removeEventListener('mouseup', endPosition);
    } else {
        applyContextSettings(previewCtx);
    }
}

function updatePenPreview() {
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    if (offscreenCanvas) {
        previewCtx.globalAlpha = parseFloat(alphaPicker.value);
        previewCtx.globalCompositeOperation = 'source-over';
        previewCtx.drawImage(offscreenCanvas, 0, 0);
    }
}

function applyContextSettings(context) {
    context.lineWidth = sizePicker.value;
    if (context === offscreenCtx) {
        context.globalCompositeOperation = 'source-over';
        context.globalAlpha = parseFloat(alphaPicker.value);
        context.strokeStyle = colorPicker.value;
        context.fillStyle = colorPicker.value;
    } else if (currentTool === 'eraser' && context === ctx) {
        context.globalCompositeOperation = 'destination-out';
        context.globalAlpha = 1.0;
        context.strokeStyle = 'rgba(0,0,0,1)';
        context.fillStyle = 'rgba(0,0,0,1)';
    } else {
        context.globalCompositeOperation = 'source-over';
        context.globalAlpha = parseFloat(alphaPicker.value);
        context.strokeStyle = colorPicker.value;
        context.fillStyle = colorPicker.value;
        context.textAlign = 'start';
        context.textBaseline = 'top';
    }
}

function drawPenPoint(context, x, y) {
    context.beginPath();
    context.arc(x, y, context.lineWidth / 2, 0, Math.PI * 2);
    context.fill();
}

function drawPenLine(e, context, step = 1) {
    if (!drawing) return;
    const pos = getMousePos(e);
    const currentX = pos.x;
    const currentY = pos.y;
    const dx = currentX - lastX;
    const dy = currentY - lastY;
    const distance = Math.hypot(dx, dy);

    for (let i = 0; i <= distance; i += step) {
        const t = distance === 0 ? 0 : i / distance;
        const x = lastX + dx * t;
        const y = lastY + dy * t;
        context.beginPath();
        context.arc(x, y, context.lineWidth / 2, 0, Math.PI * 2);
        context.fill();
    }
    lastX = currentX;
    lastY = currentY;
}

function drawShape(context, tool, startX, startY, endX, endY, e) {
    context.beginPath();
    if (tool === 'line') {
        if (e.shiftKey) {
            const deltaX = endX - startX;
            const deltaY = endY - startY;
            const angleRadians = Math.atan2(deltaY, deltaX);
            const angleDegrees = angleRadians * 180 / Math.PI;
            const roundedAngleDegrees = Math.round(angleDegrees / 45) * 45;
            const roundedAngleRadians = roundedAngleDegrees * Math.PI / 180;
            const distance = Math.hypot(deltaX, deltaY);
            const newX = startX + distance * Math.cos(roundedAngleRadians);
            const newY = startY + distance * Math.sin(roundedAngleRadians);
            context.moveTo(startX, startY);
            context.lineTo(newX, newY);
        } else {
            context.moveTo(startX, startY);
            context.lineTo(endX, endY);
        }
        context.stroke();
    } else if (tool === 'rect') {
        let width = endX - startX;
        let height = endY - startY;
        if (e.shiftKey) {
            const side = Math.max(Math.abs(width), Math.abs(height));
            width = Math.sign(width) * side;
            height = Math.sign(height) * side;
        }
        context.rect(startX, startY, width, height);
        if (fillCheckbox.checked) context.fill();
        else context.stroke();
    } else if (tool === 'circle') {
        const centerX = startX + (endX - startX) / 2;
        const centerY = startY + (endY - startY) / 2;
        let radiusX = Math.abs(endX - startX) / 2;
        let radiusY = Math.abs(endY - startY) / 2;
        if (e.shiftKey) {
            const radius = Math.max(radiusX, radiusY);
            radiusX = radiusY = radius;
        }
        context.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
        if (fillCheckbox.checked) context.fill();
        else context.stroke();
    }
}

function drawImagePreviewOrFinal(context, startX, startY, endX, endY, e, image) {
    let width = endX - startX;
    let height = endY - startY;
    if (e.shiftKey && originalImageWidth && originalImageHeight) {
        const aspectRatio = originalImageWidth / originalImageHeight;
        if (Math.abs(width) > Math.abs(height) * aspectRatio) {
            height = Math.sign(height) * Math.abs(width) / aspectRatio;
        } else {
            width = Math.sign(width) * Math.abs(height) * aspectRatio;
        }
    }
    context.globalAlpha = parseFloat(alphaPicker.value);
    context.drawImage(image, startX, startY, width, height);
    context.globalAlpha = 1.0;
}

function drawShapePreview(e) {
    if (!drawing) return;
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    const pos = getMousePos(e);
    const currentX = pos.x;
    const currentY = pos.y;
    applyContextSettings(previewCtx);
    if (currentTool === 'line' || currentTool === 'rect' || currentTool === 'circle') {
        drawShape(previewCtx, currentTool, startX, startY, currentX, currentY, e);
    } else if (currentTool === 'image' && imageToInsert) {
        drawImagePreviewOrFinal(previewCtx, startX, startY, currentX, currentY, e, imageToInsert);
    }
}

function drawSelectionPreview(e) {
    if (!drawing || currentTool !== 'select') return;
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    const pos = getMousePos(e);
    selectionEndX = pos.x;
    selectionEndY = pos.y;
    const x = Math.min(selectionStartX, selectionEndX);
    const y = Math.min(selectionStartY, selectionEndY);
    const width = Math.abs(selectionEndX - selectionStartX);
    const height = Math.abs(selectionEndY - selectionStartY);
    previewCtx.strokeStyle = '#000';
    previewCtx.lineWidth = 1;
    previewCtx.globalAlpha = 1.0;
    previewCtx.globalCompositeOperation = 'source-over';
    previewCtx.setLineDash([5, 5]);
    previewCtx.strokeRect(x, y, width, height);
    previewCtx.setLineDash([]);
}

// mousemove イベントハンドラ
function draw(e) {
    if (!drawing) return;
    if (currentTool === 'pen') {
        applyContextSettings(offscreenCtx);
        drawPenLine(e, offscreenCtx);
        updatePenPreview();
    } else if (currentTool === 'marker') {
        const step = Math.max(1, ctx.lineWidth / 10);
        drawPenLine(e, ctx, step);
    } else if (currentTool === 'eraser') {
        drawPenLine(e, ctx);
    } else if (currentTool === 'blur') {
        applyBlurAlongPath(e);
    } else if (currentTool === 'line' || currentTool === 'rect' || currentTool === 'circle' || (currentTool === 'image' && imageToInsert)) {
        drawShapePreview(e);
    } else if (currentTool === 'select') {
        drawSelectionPreview(e);
    }
}

function endPosition(e) {
    if (!drawing) return; // 描画中でなければ何もしない

    // イベントリスナーをwindowから削除
    window.removeEventListener('mousemove', draw);
    window.removeEventListener('mouseup', endPosition);

    drawing = false;

    const pos = getMousePos(e);
    // 座標は getMousePos ですでに処理されているので、ここでは単純に使う
    const endX = pos.x;
    const endY = pos.y;
    let actuallyDrew = false;

    if (currentTool === 'select') {
        selectionEndX = endX;
        selectionEndY = endY;
        const width = Math.abs(selectionEndX - selectionStartX);
        const height = Math.abs(selectionEndY - selectionStartY);
        if (width > 0 && height > 0) {
            trimBtn.disabled = false;
            copyBtn.disabled = false;
            cutBtn.disabled = false;
            mosaicBtn.disabled = false; // モザイクボタンを有効化
        } else {
            trimBtn.disabled = true;
            copyBtn.disabled = true;
            cutBtn.disabled = true;
            mosaicBtn.disabled = true; // モザイクボタンを無効化
            previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        }
        return;
    } else if (currentTool === 'paste') {
        return;
    }

    if (currentTool === 'line' || currentTool === 'rect' || currentTool === 'circle') {
        previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        applyContextSettings(ctx);
        drawShape(ctx, currentTool, startX, startY, endX, endY, e);
        actuallyDrew = true;
    } else if (currentTool === 'image' && imageToInsert) {
        if (startX !== endX || startY !== endY) {
            previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
            applyContextSettings(ctx);
            drawImagePreviewOrFinal(ctx, startX, startY, endX, endY, e, imageToInsert);
            actuallyDrew = true;
        }
    } else if (currentTool === 'pen') {
        if (offscreenCanvas) {
            ctx.globalAlpha = parseFloat(alphaPicker.value);
            ctx.globalCompositeOperation = 'source-over';
            ctx.drawImage(offscreenCanvas, 0, 0);
            previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
            if (offscreenCtx) {
                offscreenCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
            }
            actuallyDrew = true;
        }
    } else if (currentTool === 'marker' || currentTool === 'eraser' || currentTool === 'blur') {
        if (lastX !== null) actuallyDrew = true;
    }
    lastX = null;
    lastY = null;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1.0;
    saveLocal();
    if (actuallyDrew) {
        saveState();
    }
}

function loadImageToCanvas(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const img = new Image();
            img.onload = function () {
                widthInput.value = img.width;
                heightInput.value = img.height;
                resizeCanvas();
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                saveState();
                saveLocal();
            };
            img.src = e.target.result;
        }
        reader.readAsDataURL(file);
        imageUpload.value = '';
    }
}

function loadImageForInsertion(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            imageToInsert = new Image();
            imageToInsert.onload = function () {
                originalImageWidth = this.width;
                originalImageHeight = this.height;
            };
            imageToInsert.src = e.target.result;
        }
        reader.readAsDataURL(file);
    }
}

function resizeCanvas() {
    const oldImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const newWidth = parseInt(widthInput.value);
    const newHeight = parseInt(heightInput.value);
    canvas.width = newWidth;
    canvas.height = newHeight;
    previewCanvas.width = newWidth;
    previewCanvas.height = newHeight;
    ctx.putImageData(oldImageData, 0, 0);
}

function trimCanvas() {
    if (!trimBtn.disabled) {
        const x = Math.min(selectionStartX, selectionEndX);
        const y = Math.min(selectionStartY, selectionEndY);
        const width = Math.abs(selectionEndX - selectionStartX);
        const height = Math.abs(selectionEndY - selectionStartY);
        const imageData = ctx.getImageData(x, y, width, height);
        canvas.width = width;
        canvas.height = height;
        previewCanvas.width = width;
        previewCanvas.height = height;
        widthInput.value = width;
        heightInput.value = height;
        ctx.putImageData(imageData, 0, 0);
        saveState();
        saveLocal();
        previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        trimBtn.disabled = true;
        copyBtn.disabled = true;
        cutBtn.disabled = true;
        mosaicBtn.disabled = true;
    }
}

function copySelection() {
    if (!copyBtn.disabled) {
        const x = Math.min(selectionStartX, selectionEndX);
        const y = Math.min(selectionStartY, selectionEndY);
        const width = Math.abs(selectionEndX - selectionStartX);
        const height = Math.abs(selectionEndY - selectionStartY);
        clipboard = ctx.getImageData(x, y, width, height);
        updateUndoRedoButtons();
    }
}

function cutSelection() {
    if (!cutBtn.disabled) {
        const x = Math.min(selectionStartX, selectionEndX);
        const y = Math.min(selectionStartY, selectionEndY);
        const width = Math.abs(selectionEndX - selectionStartX);
        const height = Math.abs(selectionEndY - selectionStartY);
        clipboard = ctx.getImageData(x, y, width, height);
        ctx.clearRect(x, y, width, height);
        saveState();
        saveLocal();
        updateUndoRedoButtons();
        previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        trimBtn.disabled = true;
        copyBtn.disabled = true;
        cutBtn.disabled = true;
        mosaicBtn.disabled = true;
    }
}

// --- 新機能：ぼかし & モザイク ---
function applyBlurAlongPath(e) {
    if (!drawing) return;
    const pos = getMousePos(e);
    const currentX = pos.x;
    const currentY = pos.y;
    const dx = currentX - lastX;
    const dy = currentY - lastY;
    const distance = Math.hypot(dx, dy);
    const step = Math.max(1, (sizePicker.value / 2) / 4);

    for (let i = 0; i < distance; i += step) {
        const t = distance === 0 ? 0 : i / distance;
        const x = lastX + dx * t;
        const y = lastY + dy * t;
        applyBlurToPoint(x, y);
    }
    lastX = currentX;
    lastY = currentY;
}

function applyBlurToPoint(x, y) {
    const radius = Math.floor(parseInt(sizePicker.value) / 2);
    if (radius < 1) return;
    const size = radius * 2;
    const rectX = Math.floor(x - radius);
    const rectY = Math.floor(y - radius);

    try {
        const imageData = ctx.getImageData(rectX, rectY, size, size);
        const data = imageData.data;
        const blurredData = new Uint8ClampedArray(data.length);

        for (let i = 0; i < data.length; i += 4) {
            const pixelIndex = i / 4;
            const px = pixelIndex % size;
            const py = Math.floor(pixelIndex / size);

            const dist = Math.hypot(px - radius, py - radius);
            if (dist > radius) {
                blurredData[i] = data[i];
                blurredData[i + 1] = data[i + 1];
                blurredData[i + 2] = data[i + 2];
                blurredData[i + 3] = data[i + 3];
                continue;
            }

            let totalR = 0, totalG = 0, totalB = 0, totalA = 0;
            let count = 0;
            const kernelSize = 1;

            for (let ky = -kernelSize; ky <= kernelSize; ky++) {
                for (let kx = -kernelSize; kx <= kernelSize; kx++) {
                    const currentX = px + kx;
                    const currentY = py + ky;
                    if (currentX >= 0 && currentX < size && currentY >= 0 && currentY < size) {
                        const kernelIndex = (currentY * size + currentX) * 4;
                        totalR += data[kernelIndex];
                        totalG += data[kernelIndex + 1];
                        totalB += data[kernelIndex + 2];
                        totalA += data[kernelIndex + 3];
                        count++;
                    }
                }
            }
            blurredData[i] = totalR / count;
            blurredData[i + 1] = totalG / count;
            blurredData[i + 2] = totalB / count;
            blurredData[i + 3] = totalA / count;
        }
        const newImageData = new ImageData(blurredData, size, size);
        ctx.putImageData(newImageData, rectX, rectY);
    } catch (e) { /* ignore getImageData errors at canvas edges */ }
}

function applyMosaic() {
    if (mosaicBtn.disabled) return;
    const x1 = Math.min(selectionStartX, selectionEndX);
    const y1 = Math.min(selectionStartY, selectionEndY);
    const width = Math.abs(selectionEndX - selectionStartX);
    const height = Math.abs(selectionEndY - selectionStartY);
    const tileSize = parseInt(sizePicker.value, 10);
    if (tileSize <= 0) {
        alert("サイズを1以上に設定してください。");
        return;
    }

    for (let y = y1; y < y1 + height; y += tileSize) {
        for (let x = x1; x < x1 + width; x += tileSize) {
            const tileW = Math.min(tileSize, x1 + width - x);
            const tileH = Math.min(tileSize, y1 + height - y);
            const sampleX = Math.floor(x + tileW / 2);
            const sampleY = Math.floor(y + tileH / 2);
            try {
                const pixelData = ctx.getImageData(sampleX, sampleY, 1, 1).data;
                ctx.fillStyle = `rgba(${pixelData[0]}, ${pixelData[1]}, ${pixelData[2]}, ${pixelData[3] / 255})`;
                ctx.globalAlpha = 1.0;
                ctx.fillRect(x, y, tileW, tileH);
            } catch (e) {
                console.error("Mosaic error:", e);
                continue;
            }
        }
    }
    saveState();
    saveLocal();
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    trimBtn.disabled = true;
    copyBtn.disabled = true;
    cutBtn.disabled = true;
    mosaicBtn.disabled = true;
}

function rotateCanvas() {
    const angleDegrees = parseFloat(prompt("回転角度を入力してください (度):", 0));
    if (!isNaN(angleDegrees)) {
        const angleRadians = angleDegrees * Math.PI / 180;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(canvas, 0, 0);
        const rotatedWidth = Math.round(Math.abs(canvas.width * Math.cos(angleRadians)) + Math.abs(canvas.height * Math.sin(angleRadians)));
        const rotatedHeight = Math.round(Math.abs(canvas.width * Math.sin(angleRadians)) + Math.abs(canvas.height * Math.cos(angleRadians)));
        const rotatedTempCanvas = document.createElement('canvas');
        rotatedTempCanvas.width = rotatedWidth;
        rotatedTempCanvas.height = rotatedHeight;
        const rotatedTempCtx = rotatedTempCanvas.getContext('2d');
        rotatedTempCtx.translate(rotatedWidth / 2, rotatedHeight / 2);
        rotatedTempCtx.rotate(angleRadians);
        rotatedTempCtx.translate(-tempCanvas.width / 2, -tempCanvas.height / 2);
        rotatedTempCtx.drawImage(tempCanvas, 0, 0);
        canvas.width = rotatedWidth;
        canvas.height = rotatedHeight;
        previewCanvas.width = rotatedWidth;
        previewCanvas.height = rotatedHeight;
        widthInput.value = rotatedWidth;
        heightInput.value = rotatedHeight;
        ctx.drawImage(rotatedTempCanvas, 0, 0);
        saveState();
        saveLocal();
    } else {
        alert("有効な数値を入力してください。");
    }
}

function flipHorizontalCanvas() {
    const flippedTempCanvas = document.createElement('canvas');
    flippedTempCanvas.width = canvas.width;
    flippedTempCanvas.height = canvas.height;
    const flippedTempCtx = flippedTempCanvas.getContext('2d');
    flippedTempCtx.scale(-1, 1);
    flippedTempCtx.drawImage(canvas, -canvas.width, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(flippedTempCanvas, 0, 0);
    saveState();
    saveLocal();
}


// --- イベントリスナー設定 ---
// mousedown/touchstart はキャンバス内で開始する必要がある
canvas.addEventListener('mousedown', startPosition);
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    startPosition(e);
});

// タッチイベントも同様に window で end をリッスンする
canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    draw(e);
});
canvas.addEventListener('touchend', (e) => {
    endPosition(e);
});


// ツール選択ボタン
selectBtn.addEventListener('click', () => setActiveTool('select'));
eyedropperBtn.addEventListener('click', () => setActiveTool('eyedropper'));
blurBtn.addEventListener('click', () => setActiveTool('blur'));
penBtn.addEventListener('click', () => setActiveTool('pen'));
markerBtn.addEventListener('click', () => setActiveTool('marker'));
lineBtn.addEventListener('click', () => setActiveTool('line'));
rectBtn.addEventListener('click', () => setActiveTool('rect'));
circleBtn.addEventListener('click', () => setActiveTool('circle'));
eraserBtn.addEventListener('click', () => setActiveTool('eraser'));
textBtn.addEventListener('click', () => setActiveTool('text'));
imageBtn.addEventListener('click', () => setActiveTool('image'));
pasteBtn.addEventListener('click', () => setActiveTool('paste'));
imageInsert.addEventListener('change', loadImageForInsertion);
mosaicBtn.addEventListener('click', applyMosaic); // モザイクボタンのリスナー

// クリアボタン
clearBtn.addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    saveState();
    saveLocal();
    updateUndoRedoButtons();
});

// Undo/Redoボタン
undoBtn.addEventListener('click', () => {
    if (history.length > 1) {
        redoStack.push(history.pop());
        const prevState = history[history.length - 1];
        restoreState(prevState);
    }
});
redoBtn.addEventListener('click', () => {
    if (redoStack.length > 0) {
        const nextState = redoStack.pop();
        history.push(nextState);
        restoreState(nextState);
    }
});

resizeBtn.addEventListener('click', () => {
    resizeCanvas();
    saveState();
    saveLocal();
});

// 保存ボタン
saveBtn.addEventListener('click', () => {
    const format = saveFormat.value === 'jpeg' ? 'image/jpeg' : 'image/png';
    let exportCanvas = canvas;
    if (saveFormat.value === 'png-opaque' || format === 'image/jpeg') {
        exportCanvas = document.createElement('canvas');
        exportCanvas.width = canvas.width;
        exportCanvas.height = canvas.height;
        const exportCtx = exportCanvas.getContext('2d');
        exportCtx.fillStyle = "white";
        exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
        exportCtx.drawImage(canvas, 0, 0);
    }
    const link = document.createElement('a');
    link.download = `drawing.${format === 'image/jpeg' ? 'jpg' : 'png'}`;
    link.href = exportCanvas.toDataURL(format, 1.0);
    link.click();
});

uploadBtn.addEventListener('click', () => imageUpload.click());
imageUpload.addEventListener('change', loadImageToCanvas);
trimBtn.addEventListener('click', trimCanvas);
copyBtn.addEventListener('click', copySelection);
cutBtn.addEventListener('click', cutSelection);
scaleBtn.addEventListener('click', () => {
    const magnification = prompt("変更後の倍率をパーセントで入力してください:", 100);
    if (magnification !== null) {
        const zoomFactor = parseFloat(magnification) / 100;
        if (!isNaN(zoomFactor) && zoomFactor > 0) {
            const newWidth = Math.round(canvas.width * zoomFactor);
            const newHeight = Math.round(canvas.height * zoomFactor);
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(canvas, 0, 0);
            canvas.width = newWidth;
            canvas.height = newHeight;
            previewCanvas.width = newWidth;
            previewCanvas.height = newHeight;
            widthInput.value = newWidth;
            heightInput.value = newHeight;
            ctx.drawImage(tempCanvas, 0, 0, tempCanvas.width, tempCanvas.height, 0, 0, canvas.width, canvas.height);
            saveState();
            saveLocal();
        } else {
            alert('有効な倍率（0より大きい数値）を入力してください。');
        }
    }
});

rotateBtn.addEventListener('click', rotateCanvas);
flipHorizontalBtn.addEventListener('click', flipHorizontalCanvas);

initializeCanvas();