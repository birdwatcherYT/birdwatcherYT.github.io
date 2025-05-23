const canvas = document.getElementById('drawCanvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const previewCanvas = document.getElementById('previewCanvas');
const previewCtx = previewCanvas.getContext('2d', { willReadFrequently: true });
const canvasContainer = document.getElementById('canvasContainer');

let drawing = false;
let history = [];
let redoStack = [];
let currentTool = 'pen'; // 現在のツール ('pen', 'marker', 'line', 'rect', 'circle', 'eraser', 'text', 'image', 'select', 'eyedropper')
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
const eyedropperBtn = document.getElementById('eyedropperBtn'); // スポイトボタン取得

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
    // canvasContainer.style.width = initialWidth + 'px';
    // canvasContainer.style.height = initialHeight + 'px';
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
        // canvasContainer.style.width = state.width + 'px';
        // canvasContainer.style.height = state.height + 'px';
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
    const buttons = [selectBtn, penBtn, markerBtn, lineBtn, rectBtn, circleBtn, eraserBtn, textBtn, imageBtn, pasteBtn, eyedropperBtn]; // スポイトボタン追加
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
    if (toolName === 'eraser') {
        canvas.style.cursor = 'cell'; // 消しゴムカーソル
    } else if (toolName === 'text') {
        canvas.style.cursor = 'text'; // テキストカーソル
    } else if (toolName === 'paste' && clipboard) {
        canvas.style.cursor = 'copy'; // 貼り付けカーソル
    } else {
        canvas.style.cursor = 'crosshair'; // デフォルトカーソル
    }
    // 選択ツールが非アクティブになったらプレビューをクリアし、トリミングボタンを無効化
    if (currentTool !== 'select') {
        previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        trimBtn.disabled = true;
        copyBtn.disabled = true;
        cutBtn.disabled = true;
    }
}

// --- 描画関数 ---
function getMousePos(e) {
    const rect = canvas.getBoundingClientRect(); // キャンバスの絶対位置とサイズを取得
    if (e.touches && e.touches.length > 0) {
        return {
            x: e.touches[0].clientX - rect.left,
            y: e.touches[0].clientY - rect.top
        };
    } else if (e.changedTouches && e.changedTouches.length > 0) {
        return {
            x: e.changedTouches[0].clientX - rect.left,
            y: e.changedTouches[0].clientY - rect.top
        };
    }
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}

function startPosition(e) {
    // 左クリック以外は無視
    // タッチの場合はe.buttonがundefinedなため、存在する場合のみチェック
    if (e.button !== undefined && e.button !== 0) return;

    drawing = true;
    const pos = getMousePos(e);
    startX = pos.x;
    startY = pos.y;

    // スポイトツールの処理
    if (currentTool === 'eyedropper') {
        const pixelData = ctx.getImageData(startX, startY, 1, 1).data;
        const r = pixelData[0];
        const g = pixelData[1];
        const b = pixelData[2];
        const a = pixelData[3]; // アルファ値を取得
        const alphaValue = a / 255; // アルファ値を0-1の範囲に変換
        const hexColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        colorPicker.value = hexColor;
        alphaPicker.value = alphaValue; // 透明度スライダーに値を設定
        drawing = false; // スポイトはクリックのみで描画しない
        // 必要であれば、色選択後に前のツールに戻すなどの処理を追加
        // setActiveTool('pen'); // 例: ペンツールに戻す
        return; // スポイトの場合はここで処理終了
    }

    lastX = startX;
    lastY = startY;

    if (currentTool === 'select') {
        selectionStartX = startX;
        selectionStartY = startY;
    } else if (currentTool === 'pen') {
        // オフスクリーンキャンバス準備
        if (!offscreenCanvas) {
            offscreenCanvas = document.createElement('canvas');
        }
        offscreenCanvas.width = canvas.width;
        offscreenCanvas.height = canvas.height;
        offscreenCtx = offscreenCanvas.getContext('2d');
        offscreenCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
        applyContextSettings(offscreenCtx); // オフスクリーンコンテキストに設定適用
        drawPenPoint(offscreenCtx, startX, startY); // offscreenCtx に描画
        updatePenPreview();
    } else if (currentTool === 'marker') {
        applyContextSettings(ctx); // メインコンテキストに設定適用
        drawPenPoint(ctx, startX, startY); // 開始点に点を描画
    } else if (currentTool === 'eraser') {
        applyContextSettings(ctx); // メインコンテキストに設定適用
        drawPenPoint(ctx, startX, startY); // 消しゴムは常にarcFill方式で点を描画
    } else if (currentTool === 'text') {
        // テキスト入力処理
        const text = prompt("テキストを入力してください:", "");
        if (text) {
            applyContextSettings(ctx);
            ctx.font = `${sizePicker.value * 2}px sans-serif`; // サイズを調整
            ctx.fillText(text, startX, startY);
            saveState();
            saveLocal();
        }
        drawing = false; // テキスト入力はドラッグではないので即終了
    } else if (currentTool === 'paste' && clipboard) {
        // この書き方では透過が維持されない
        // ctx.globalCompositeOperation = 'source-over';
        // ctx.putImageData(clipboard, startX, startY);

        // 透過を維持するために、別のキャンバスを使用
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = clipboard.width;
        tempCanvas.height = clipboard.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.putImageData(clipboard, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1.0; // 貼り付けは不透明
        ctx.drawImage(tempCanvas, startX, startY);
        saveState();
        saveLocal();
        drawing = false; // 貼り付けもドラッグではない
    } else {
        // 図形ツールの場合、プレビュー設定
        applyContextSettings(previewCtx);
    }
}

// ペンのプレビュー更新関数
function updatePenPreview() {
    // プレビューキャンバスをクリア
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

    if (offscreenCanvas) { // オフスクリーンが存在すれば
        // プレビューにはユーザー指定の透明度を適用
        previewCtx.globalAlpha = parseFloat(alphaPicker.value);
        // 合成モードもメインキャンバス合成時と同じものを適用
        previewCtx.globalCompositeOperation = 'source-over';
        // オフスクリーン内容をプレビューに描画
        previewCtx.drawImage(offscreenCanvas, 0, 0);
    }
}
// コンテキストに現在の設定を適用するヘルパー関数
function applyContextSettings(context) {
    context.lineWidth = sizePicker.value;
    // context.lineCap = 'round';
    // context.lineJoin = 'round';

    // オフスクリーンキャンバス(offscreenCtx)の場合は常にsource-over
    if (context === offscreenCtx) {
        context.globalCompositeOperation = 'source-over';
        context.globalAlpha = parseFloat(alphaPicker.value);
        context.strokeStyle = colorPicker.value;
        context.fillStyle = colorPicker.value;
    } else if (currentTool === 'eraser' && context === ctx) {
        // メインキャンバス(ctx)の場合のみ消しゴム処理を考慮
        context.globalCompositeOperation = 'destination-out';
        context.globalAlpha = 1.0; // 消しゴムは常に不透明
        context.strokeStyle = 'rgba(0,0,0,1)';
        context.fillStyle = 'rgba(0,0,0,1)';
    } else {// 通常描画処理
        context.globalCompositeOperation = 'source-over';
        context.globalAlpha = parseFloat(alphaPicker.value);
        context.strokeStyle = colorPicker.value;
        context.fillStyle = colorPicker.value; // fill用にも色を設定
        context.textAlign = 'start'; // テキストの揃えを左上に設定
        context.textBaseline = 'top'; // テキストのベースラインを上端に設定
    }
}

// 点を描画する関数 (ペン/消しゴムの開始点・クリック時 - arcFillメソッド用)
function drawPenPoint(context, x, y) {
    // applyContextSettings が事前に呼び出されている前提
    context.beginPath();
    context.arc(x, y, context.lineWidth / 2, 0, Math.PI * 2);
    context.fill(); // fillStyleが適用される
}

// ペン/消しゴムの描画処理
function drawPenLine(e, context, step = 1) {
    if (!drawing) return;
    const pos = getMousePos(e);
    const currentX = pos.x;
    const currentY = pos.y;

    // --- 座標補間と描画 (最初の実装から流用) ---
    const dx = currentX - lastX;
    const dy = currentY - lastY;
    const distance = Math.hypot(dx, dy);

    for (let i = 0; i <= distance; i += step) {
        // ゼロ除算を避ける
        const t = distance === 0 ? 0 : i / distance;
        const x = lastX + dx * t;
        const y = lastY + dy * t;

        // 各補間点に円を描画して塗りつぶす
        context.beginPath();
        // 半径は線の太さ(lineWidth)の半分
        context.arc(x, y, context.lineWidth / 2, 0, Math.PI * 2);
        context.fill(); // fill() で描画する (fillStyleとglobalAlphaが使われる)
    }

    // 次の描画のために座標を更新
    lastX = currentX;
    lastY = currentY;
}

function drawShape(context, tool, startX, startY, endX, endY, e) {
    context.beginPath();
    if (tool === 'line') {
        if (e.shiftKey) { // 水平・垂直・45度線
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
        if (e.shiftKey) { // 正方形
            const side = Math.max(Math.abs(width), Math.abs(height));
            width = Math.sign(width) * side;
            height = Math.sign(height) * side;
        }
        context.rect(startX, startY, width, height);

        if (fillCheckbox.checked) {
            context.fill(); // 塗りつぶし
        } else {
            context.stroke(); // 線描画
        }
    } else if (tool === 'circle') {
        const centerX = startX + (endX - startX) / 2;
        const centerY = startY + (endY - startY) / 2;
        let radiusX = Math.abs(endX - startX) / 2;
        let radiusY = Math.abs(endY - startY) / 2;

        if (e.shiftKey) { // 正円
            const radius = Math.max(radiusX, radiusY);
            radiusX = radius;
            radiusY = radius;
        }
        context.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
        if (fillCheckbox.checked) {
            context.fill(); // 塗りつぶし
        } else {
            context.stroke(); // 線描画
        }
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
    // ここで透明度を設定
    context.globalAlpha = parseFloat(alphaPicker.value);
    context.drawImage(image, startX, startY, width, height);
    // 描画後、念のためグローバルアルファをリセット (他の描画に影響を与えないように)
    context.globalAlpha = 1.0;
}


// 図形のプレビューを描画する関数
function drawShapePreview(e) {
    if (!drawing) return;
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height); // プレビューをクリア

    const pos = getMousePos(e);
    const currentX = pos.x;
    const currentY = pos.y;

    applyContextSettings(previewCtx); // プレビューに設定適用

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

    previewCtx.strokeStyle = '#000'; // 選択範囲の枠線は黒
    previewCtx.lineWidth = 1; // 選択範囲の枠線は1px
    previewCtx.globalAlpha = 1.0; // 選択範囲の枠線は不透明
    previewCtx.globalCompositeOperation = 'source-over'; // 通常描画モード
    // 破線を設定
    previewCtx.setLineDash([5, 5]); // [線の長さ, 空白の長さ]
    previewCtx.strokeRect(x, y, width, height);
    // 破線をリセット (他の描画に影響を与えないように)
    previewCtx.setLineDash([]);
}

// mousemove イベントハンドラ
function draw(e) {
    if (!drawing) return;

    if (currentTool === 'pen') {
        applyContextSettings(offscreenCtx); // オフスクリーンコンテキストに設定適用
        drawPenLine(e, offscreenCtx);
        updatePenPreview();
    } else if (currentTool === 'marker') {
        const step = Math.max(1, ctx.lineWidth / 10);
        drawPenLine(e, ctx, step);
    } else if (currentTool === 'eraser') {
        // 消しゴムは常にarcFill方式
        drawPenLine(e, ctx);
    } else if (currentTool === 'line' || currentTool === 'rect' || currentTool === 'circle' || (currentTool === 'image' && imageToInsert)) {
        drawShapePreview(e);
    } else if (currentTool === 'select') {
        drawSelectionPreview(e);
    }
}

function endPosition(e) {
    // 左クリックのリリース以外、または描画中でなければ無視
    // mouseoutイベントの場合、buttonプロパティがないことがあるので drawing フラグのみチェック
    if (!drawing) return;
    // buttonプロパティが存在し、かつそれが左ボタン(0)でない場合は無視 (mouseout対策)
    if (e.button !== undefined && e.button !== 0 && !(e.type === 'touchend')) return; // touchendも考慮

    drawing = false;

    const pos = getMousePos(e);
    // mouseoutで座標がcanvas外になる場合があるため、範囲内に収める（任意）
    const endX = Math.max(0, Math.min(pos.x, canvas.width));
    const endY = Math.max(0, Math.min(pos.y, canvas.height));
    let actuallyDrew = false; // 実際に描画が行われたかのフラグ

    if (currentTool === 'select') {
        selectionEndX = endX;
        selectionEndY = endY;

        // 選択範囲が有効であればトリミング/コピー/カットボタンを有効にする
        const width = Math.abs(selectionEndX - selectionStartX);
        const height = Math.abs(selectionEndY - selectionStartY);
        if (width > 0 && height > 0) {
            trimBtn.disabled = false;
            copyBtn.disabled = false;
            cutBtn.disabled = false;
        } else {
            trimBtn.disabled = true;
            copyBtn.disabled = true;
            cutBtn.disabled = true;
            previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        }
        return; // 選択モードの場合はここで終了
    } else if (currentTool === 'paste') {
        // 貼り付けはstartPositionで行われるため、ここでは何もしない
        return;
    }

    // 図形や画像をメインキャンバスに確定描画
    if (currentTool === 'line' || currentTool === 'rect' || currentTool === 'circle') {
        previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        applyContextSettings(ctx);
        drawShape(ctx, currentTool, startX, startY, endX, endY, e);
        actuallyDrew = true; // 描画した
    } else if (currentTool === 'image' && imageToInsert) {
        if (startX !== endX && startY !== endY) { // 幅高さがゼロでないか
            previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
            applyContextSettings(ctx);
            drawImagePreviewOrFinal(ctx, startX, startY, endX, endY, e, imageToInsert);
            actuallyDrew = true;
        }
    } else if (currentTool === 'pen') {
        // オフスクリーンキャンバスの内容をメインキャンバスに転写
        if (offscreenCanvas) {
            // メインキャンバスにオフスクリーン内容を合成
            ctx.globalAlpha = parseFloat(alphaPicker.value); // 透明度適用
            ctx.globalCompositeOperation = 'source-over'; // 合成モード適用
            ctx.drawImage(offscreenCanvas, 0, 0); // 合成！

            // 後処理
            previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height); // プレビュー消去
            // オフスクリーンもクリアしておく (次の描画のため)
            if (offscreenCtx) {
                offscreenCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
            }
            actuallyDrew = true;
        }
    } else if (currentTool === 'marker') {
        // mousemove中に描画済み
        if (lastX !== null) actuallyDrew = true;
    } else if (currentTool === 'eraser') {
        // 消しゴムはmousemove中に描画済み
        if (lastX !== null) actuallyDrew = true;
    }
    // ペン/消しゴムの後処理
    lastX = null;
    lastY = null;
    // 描画後のコンテキスト設定をリセット（特にglobalCompositeOperation）
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1.0;

    // 描画後の状態をローカルストレージに保存
    saveLocal();

    // 実際に描画が行われた場合のみ、その状態を履歴に保存
    if (actuallyDrew) {
        saveState();
    }
}

// 画像を読み込んでキャンバスに描画する関数 (ファイルを開く)
function loadImageToCanvas(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const img = new Image();
            img.onload = function () {
                // 画像のサイズに合わせてキャンバスをリサイズする
                widthInput.value = img.width;
                heightInput.value = img.height;
                resizeCanvas(); // キャンバスのリサイズ処理を実行
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

// 画像を読み込んで挿入する関数
function loadImageForInsertion(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            imageToInsert = new Image();
            imageToInsert.onload = function () {
                // 画像が読み込まれたら、描画開始を許可
                originalImageWidth = this.width;
                originalImageHeight = this.height;
            };
            imageToInsert.src = e.target.result;
        }
        reader.readAsDataURL(file);
    }
}

// キャンバスのリサイズ処理を関数化
function resizeCanvas() {
    const oldImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const newWidth = parseInt(widthInput.value);
    const newHeight = parseInt(heightInput.value);

    // 各要素のリサイズ
    // canvasContainer.style.width = newWidth + 'px';
    // canvasContainer.style.height = newHeight + 'px';
    canvas.width = newWidth;
    canvas.height = newHeight;
    previewCanvas.width = newWidth;
    previewCanvas.height = newHeight;

    // 内容を復元
    ctx.putImageData(oldImageData, 0, 0);
}

function trimCanvas() {
    if (!trimBtn.disabled) {
        const x = Math.min(selectionStartX, selectionEndX);
        const y = Math.min(selectionStartY, selectionEndY);
        const width = Math.abs(selectionEndX - selectionStartX);
        const height = Math.abs(selectionEndY - selectionStartY);

        const imageData = ctx.getImageData(x, y, width, height);

        // リサイズ
        // canvasContainer.style.width = width + 'px';
        // canvasContainer.style.height = height + 'px';
        canvas.width = width;
        canvas.height = height;
        previewCanvas.width = width;
        previewCanvas.height = height;
        widthInput.value = width;
        heightInput.value = height;

        // 描画
        ctx.putImageData(imageData, 0, 0);

        // 状態保存
        saveState();
        saveLocal();

        // 選択解除とボタン無効化
        previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        trimBtn.disabled = true;
        copyBtn.disabled = true;
        cutBtn.disabled = true;
    }
}
function copySelection() {
    if (!copyBtn.disabled) {
        const x = Math.min(selectionStartX, selectionEndX);
        const y = Math.min(selectionStartY, selectionEndY);
        const width = Math.abs(selectionEndX - selectionStartX);
        const height = Math.abs(selectionEndY - selectionStartY);

        clipboard = ctx.getImageData(x, y, width, height);
        updateUndoRedoButtons(); // 貼り付けボタンの状態を更新
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
        updateUndoRedoButtons(); // 貼り付けボタンの状態を更新
        previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        trimBtn.disabled = true;
        copyBtn.disabled = true;
        cutBtn.disabled = true;
    }
}

function rotateCanvas() {
    const angleDegrees = parseFloat(prompt("回転角度を入力してください (度):", 0));
    if (!isNaN(angleDegrees)) {
        const angleRadians = angleDegrees * Math.PI / 180;

        // 現在のキャンバス内容を一時的なキャンバスに保存
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(canvas, 0, 0);

        // 回転後のサイズを計算
        const rotatedWidth = Math.round(Math.abs(canvas.width * Math.cos(angleRadians)) + Math.abs(canvas.height * Math.sin(angleRadians)));
        const rotatedHeight = Math.round(Math.abs(canvas.width * Math.sin(angleRadians)) + Math.abs(canvas.height * Math.cos(angleRadians)));

        // 一時的なキャンバスのサイズを回転後のサイズに合わせる
        const rotatedTempCanvas = document.createElement('canvas');
        rotatedTempCanvas.width = rotatedWidth;
        rotatedTempCanvas.height = rotatedHeight;
        const rotatedTempCtx = rotatedTempCanvas.getContext('2d');

        // 回転の中心を一時的なキャンバスの中心に移動
        rotatedTempCtx.translate(rotatedWidth / 2, rotatedHeight / 2);
        // 回転
        rotatedTempCtx.rotate(angleRadians);
        // 元の位置に戻す
        rotatedTempCtx.translate(-tempCanvas.width / 2, -tempCanvas.height / 2);
        // 元のキャンバスの内容を回転した一時的なキャンバスに描画
        rotatedTempCtx.drawImage(tempCanvas, 0, 0);

        // メインキャンバスのサイズを変更
        canvas.width = rotatedWidth;
        canvas.height = rotatedHeight;
        previewCanvas.width = rotatedWidth;
        previewCanvas.height = rotatedHeight;
        widthInput.value = rotatedWidth;
        heightInput.value = rotatedHeight;

        // 回転した一時的なキャンバスの内容をメインキャンバスに描画
        ctx.drawImage(rotatedTempCanvas, 0, 0);

        // 状態保存
        saveState();
        saveLocal();
    } else {
        alert("有効な数値を入力してください。");
    }
}

function flipHorizontalCanvas() {
    // 一時的なキャンバスで水平方向に反転
    const flippedTempCanvas = document.createElement('canvas');
    flippedTempCanvas.width = canvas.width;
    flippedTempCanvas.height = canvas.height;
    const flippedTempCtx = flippedTempCanvas.getContext('2d');

    // 反転
    flippedTempCtx.scale(-1, 1);
    flippedTempCtx.drawImage(canvas, -canvas.width, 0);

    // メインキャンバスをクリア
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // 反転した一時的なキャンバスの内容をメインキャンバスに描画
    ctx.drawImage(flippedTempCanvas, 0, 0);

    // 状態保存
    saveState();
    saveLocal();
}


// --- イベントリスナー設定 ---
canvas.addEventListener('mousedown', startPosition);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', endPosition);
// canvasからマウスが出た場合も描画終了とする
canvas.addEventListener('mouseout', (e) => {
    if (drawing) {
        // mouseout時はmouseupと同じ扱いとするが、座標はイベントから取得
        endPosition(e);
    }
});

function isInside(e) {
    if (e.targetTouches.length === 1) {
        const rect = canvas.getBoundingClientRect();
        const touch = e.targetTouches[0];

        return (
            touch.clientX >= rect.left &&
            touch.clientX <= rect.right &&
            touch.clientY >= rect.top &&
            touch.clientY <= rect.bottom
        );
    }
    return false;
}

// タッチイベントの追加
canvas.addEventListener('touchstart', (e) => {
    if (!isInside(e)) return;
    e.preventDefault();
    startPosition(e);
});
canvas.addEventListener('touchmove', (e) => {
    if (!isInside(e)) return;
    e.preventDefault();
    draw(e);
});
canvas.addEventListener('touchend', (e) => {
    endPosition(e);
});

// ツール選択ボタン
selectBtn.addEventListener('click', () => setActiveTool('select'));
eyedropperBtn.addEventListener('click', () => setActiveTool('eyedropper')); // スポイトボタンのリスナー追加
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

// クリアボタン
clearBtn.addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    saveState();
    saveLocal();
    updateUndoRedoButtons();
});

// Undoボタン
undoBtn.addEventListener('click', () => {
    if (history.length > 1) { // 最初の状態はUndoできない
        // 現在の状態(historyの最後)をredoStackに保存
        redoStack.push(history[history.length - 1]);
        // historyから最後の状態を削除
        history.pop();
        // 1つ前の状態(historyの新しい最後)を取得して復元
        const prevState = history[history.length - 1];
        restoreState(prevState);
        // ボタン状態更新は restoreState 内で行われる
    }
});

// Redoボタン
redoBtn.addEventListener('click', () => {
    if (redoStack.length > 0) {
        // Redoする状態を取り出す
        const nextState = redoStack.pop();
        // Redoする状態をhistoryに追加
        history.push(nextState);
        // Redoする状態を復元
        restoreState(nextState);
        // ボタン状態更新は restoreState 内で行われる
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
        // 背景を白で合成する新しいキャンバスを作成
        exportCanvas = document.createElement('canvas');
        exportCanvas.width = canvas.width;
        exportCanvas.height = canvas.height;
        const exportCtx = exportCanvas.getContext('2d');
        exportCtx.fillStyle = "white";
        exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
        exportCtx.drawImage(canvas, 0, 0); // 元のキャンバスの内容を描画
    }

    const link = document.createElement('a');
    link.download = `drawing.${format === 'image/jpeg' ? 'jpg' : 'png'}`;
    link.href = exportCanvas.toDataURL(format, 1.0);
    link.click();
});

uploadBtn.addEventListener('click', () => imageUpload.click());
imageUpload.addEventListener('change', loadImageToCanvas);
// トリミングボタン
trimBtn.addEventListener('click', trimCanvas);
// コピーボタン
copyBtn.addEventListener('click', copySelection);
// カットボタン
cutBtn.addEventListener('click', cutSelection);
// 拡大縮小ボタン
scaleBtn.addEventListener('click', () => {
    const magnification = prompt("変更後の倍率をパーセントで入力してください:", 100);
    if (magnification !== null) {
        const zoomFactor = parseFloat(magnification) / 100;
        if (!isNaN(zoomFactor) && zoomFactor > 0) {
            const newWidth = Math.round(canvas.width * zoomFactor); // originalCanvasWidth を使用
            const newHeight = Math.round(canvas.height * zoomFactor); // originalCanvasHeight を使用

            // 現在のキャンバス内容を一時的なキャンバスに保存
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(canvas, 0, 0);

            // サイズを変更
            // canvasContainer.style.width = newWidth + 'px';
            // canvasContainer.style.height = newHeight + 'px';
            canvas.width = newWidth;
            canvas.height = newHeight;
            previewCanvas.width = newWidth;
            previewCanvas.height = newHeight;
            widthInput.value = newWidth;
            heightInput.value = newHeight;

            ctx.drawImage(tempCanvas, 0, 0, tempCanvas.width, tempCanvas.height, 0, 0, canvas.width, canvas.height);

            // 状態保存
            saveState();
            saveLocal();
        } else {
            alert('有効な倍率（0より大きい数値）を入力してください。');
        }
    }
});

// 回転ボタンのイベントリスナー
rotateBtn.addEventListener('click', rotateCanvas);
flipHorizontalBtn.addEventListener('click', flipHorizontalCanvas);

initializeCanvas();
