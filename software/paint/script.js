const canvas = document.getElementById('drawCanvas');
const ctx = canvas.getContext('2d');
const previewCanvas = document.getElementById('previewCanvas');
const previewCtx = previewCanvas.getContext('2d');
const canvasContainer = document.getElementById('canvasContainer');

let drawing = false;
let eraser = false; // 消しゴムモードかどうかのフラグ
let history = [];
let redoStack = [];
let currentTool = 'pen'; // 現在のツール ('pen', 'line', 'rect', 'circle', 'eraser')
let startX, startY; // 描画開始座標
let lastX = null, lastY = null; // ペンツール用

const storageKey = "birdwatcheryt_github_io_software_paint";

// --- DOM要素取得 ---
const colorPicker = document.getElementById('colorPicker');
const sizePicker = document.getElementById('sizePicker');
const alphaPicker = document.getElementById('alphaPicker');
const penBtn = document.getElementById('penBtn');
const lineBtn = document.getElementById('lineBtn');
const rectBtn = document.getElementById('rectBtn');
const circleBtn = document.getElementById('circleBtn');
const eraserBtn = document.getElementById('eraserBtn');
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');
const clearBtn = document.getElementById('clearBtn');
const saveBtn = document.getElementById('saveBtn');
const saveFormat = document.getElementById('saveFormat');
const widthInput = document.getElementById('canvasWidth');
const heightInput = document.getElementById('canvasHeight');
const resizeBtn = document.getElementById('resizeBtn');

// --- 初期化処理 ---
// --- 初期化処理 ---
function initializeCanvas() {
    let initialWidth = 800; // デフォルト幅
    let initialHeight = 400; // デフォルト高さ
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

                // input要素にも復元したサイズを反映
                widthInput.value = initialWidth;
                heightInput.value = initialHeight;
            }
        }
    } catch (error) {
        console.error("LocalStorage Load/Parse Error:", error);
        // エラー発生時はLocalStorageの該当データを削除（推奨）
        localStorage.removeItem(storageKey);
    }

    // 取得したサイズまたはデフォルトサイズでキャンバスを設定
    canvasContainer.style.width = initialWidth + 'px';
    canvasContainer.style.height = initialHeight + 'px';
    canvas.width = initialWidth;
    canvas.height = initialHeight;
    previewCanvas.width = initialWidth;
    previewCanvas.height = initialHeight;

    // 画像データがあれば復元
    if (initialImageData) {
        // restoreState は画像データのみを受け取る
        restoreState({ imageData: initialImageData, width: initialWidth, height: initialHeight });
        // ローカルストレージから復元した場合、それを最初の履歴として保存
        history = [{ imageData: initialImageData, width: initialWidth, height: initialHeight }];
    } else {
        // 何もない状態を最初の履歴として保存 (背景は白とする場合)
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
    // ボタンの状態更新などが必要ならここで行う (例: Undo/Redoボタンの有効/無効)
    updateUndoRedoButtons();
}

function restoreState(state) {
    const img = new Image();
    img.onload = () => {
        // キャンバスのサイズを復元
        canvasContainer.style.width = state.width + 'px';
        canvasContainer.style.height = state.height + 'px';
        canvas.width = state.width;
        canvas.height = state.height;
        previewCanvas.width = state.width;
        previewCanvas.height = state.height;
        widthInput.value = state.width;
        heightInput.value = state.height;

        // globalAlphaをリセット (前回修正済み)
        ctx.globalAlpha = 1.0;
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
    undoBtn.disabled = history.length <= 1; // 最初の状態以外ならUndo可能
    redoBtn.disabled = redoStack.length === 0;
}

// --- ツール関連 ---
function setActiveTool(toolName) {
    currentTool = toolName;
    eraser = (toolName === 'eraser'); // 消しゴムツールが選択されたか

    // ボタンのハイライト処理
    const buttons = [penBtn, lineBtn, rectBtn, circleBtn, eraserBtn];
    buttons.forEach(btn => {
        if (btn) { // ボタンが存在するか確認
            btn.classList.remove('active');
        }
    });

    const activeBtn = document.getElementById(toolName + 'Btn');
    if (activeBtn) {
        activeBtn.classList.add('active');
    }

    // 消しゴムボタンのテキスト
    eraserBtn.textContent = '消しゴム'; // デフォルトに戻す

    // カーソルの変更（任意）
    // canvas.style.cursor = toolName === 'eraser' ? 'cell' : 'crosshair';
}

// --- 描画関数 ---
function getMousePos(e) {
    const rect = canvas.getBoundingClientRect(); // キャンバスの絶対位置とサイズを取得
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}

function startPosition(e) {
    // 左クリック以外は無視
    if (e.button !== 0) return;

    drawing = true;
    const pos = getMousePos(e);
    startX = pos.x;
    startY = pos.y;

    // ペン/消しゴムモードの場合、最初の点を打つ
    if (currentTool === 'pen' || currentTool === 'eraser') {
        lastX = startX;
        lastY = startY;
        applyContextSettings(ctx);
        drawPenPoint(ctx, startX, startY);
    } else {
        // 図形ツールの場合、プレビュー設定
        applyContextSettings(previewCtx);
    }
}

// コンテキストに現在の設定を適用するヘルパー関数
function applyContextSettings(context) {
    context.lineWidth = sizePicker.value;
    context.lineCap = 'round';
    context.lineJoin = 'round';

    if (eraser && context === ctx) { // メインキャンバスでの消しゴム処理
        context.globalCompositeOperation = 'destination-out';
        context.globalAlpha = 1.0; // 消しゴムは常に不透明
        // strokeStyleはdestination-outでは効果がないが一応設定
        context.strokeStyle = 'rgba(0,0,0,1)';
        context.fillStyle = 'rgba(0,0,0,1)';
    } else { // 通常のペンまたはプレビュー
        context.globalCompositeOperation = 'source-over';
        context.globalAlpha = parseFloat(alphaPicker.value);
        context.strokeStyle = colorPicker.value;
        context.fillStyle = colorPicker.value; // fill用にも色を設定
    }
}

// 点を描画する関数 (ペン/消しゴムの開始点・クリック時)
function drawPenPoint(context, x, y) {
    context.beginPath();
    context.arc(x, y, context.lineWidth / 2, 0, Math.PI * 2);
    context.fill(); // fillStyleが適用される
}

// ペン/消しゴムの描画処理を最初の実装（補間 + arc/fill）
function drawPenLine(e) {
    if (!drawing) return;
    const pos = getMousePos(e);
    const currentX = pos.x;
    const currentY = pos.y;

    // --- 設定を ctx に適用 ---
    ctx.lineWidth = sizePicker.value;
    ctx.lineCap = 'round'; // 丸い先端

    // 消しゴムかペンかで設定を分ける
    if (eraser) { // グローバル変数 eraser を参照
        ctx.globalCompositeOperation = 'destination-out'; // 消しゴム効果
        ctx.globalAlpha = 1.0; // 消しゴムは常に不透明
        // destination-out では色は影響しないが、念のため設定
        ctx.fillStyle = 'rgba(0,0,0,1)';
    } else {
        ctx.globalCompositeOperation = 'source-over'; // 通常描画
        ctx.globalAlpha = parseFloat(alphaPicker.value); // 透明度を適用
        ctx.fillStyle = colorPicker.value; // fillStyle に描画色を設定
    }

    // --- 座標補間と描画 (最初の実装から流用) ---
    const dx = currentX - lastX;
    const dy = currentY - lastY;
    const distance = Math.hypot(dx, dy);
    // stepの値が小さいほど滑らかになるが、処理負荷が上がる可能性がある
    const step = 1;

    for (let i = 0; i <= distance; i += step) {
        // ゼロ除算を避ける
        const t = distance === 0 ? 0 : i / distance;
        const x = lastX + dx * t;
        const y = lastY + dy * t;

        // 各補間点に円を描画して塗りつぶす
        ctx.beginPath();
        // 半径は線の太さ(lineWidth)の半分
        ctx.arc(x, y, ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.fill(); // fill() で描画する
    }
    // --- ここまで ---

    // 次の描画のために座標を更新
    lastX = currentX;
    lastY = currentY;
}

// 図形のプレビューを描画する関数
function drawShapePreview(e) {
    if (!drawing) return;
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height); // プレビューをクリア

    const pos = getMousePos(e);
    const currentX = pos.x;
    const currentY = pos.y;

    applyContextSettings(previewCtx); // プレビューに設定適用
    previewCtx.beginPath();

    if (currentTool === 'line') {
        previewCtx.moveTo(startX, startY);
        previewCtx.lineTo(currentX, currentY);
    } else if (currentTool === 'rect') {
        previewCtx.rect(startX, startY, currentX - startX, currentY - startY);
    } else if (currentTool === 'circle') {
        const radius = Math.hypot(currentX - startX, currentY - startY);
        previewCtx.arc(startX, startY, radius, 0, Math.PI * 2);
    }
    previewCtx.stroke();
}

// mousemove イベントハンドラ
function draw(e) {
    if (!drawing) return;

    if (currentTool === 'pen' || currentTool === 'eraser') {
        drawPenLine(e);
    } else if (currentTool === 'line' || currentTool === 'rect' || currentTool === 'circle') {
        drawShapePreview(e);
    }
}
function endPosition(e) {
    // 左クリックのリリース以外、または描画中でなければ無視
    // mouseoutイベントの場合、buttonプロパティがないことがあるので drawing フラグのみチェック
    if (!drawing) return;
    // buttonプロパティが存在し、かつそれが左ボタン(0)でない場合は無視 (mouseout対策)
    if (e.button !== undefined && e.button !== 0) return;

    drawing = false;

    const pos = getMousePos(e);
    // mouseoutで座標がcanvas外になる場合があるため、範囲内に収める（任意）
    const endX = Math.max(0, Math.min(pos.x, canvas.width));
    const endY = Math.max(0, Math.min(pos.y, canvas.height));


    let actuallyDrew = false; // 実際に描画が行われたかのフラグ

    // 図形をメインキャンバスに確定描画
    if (currentTool === 'line' || currentTool === 'rect' || currentTool === 'circle') {
        previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        applyContextSettings(ctx);
        ctx.beginPath();

        if (currentTool === 'line') {
            if (startX !== endX || startY !== endY) { // ゼロ距離でないか
                ctx.moveTo(startX, startY);
                ctx.lineTo(endX, endY);
                ctx.stroke();
                actuallyDrew = true; // 描画した
            }
        } else if (currentTool === 'rect') {
            if (startX !== endX && startY !== endY) { // 幅高さがゼロでないか
                ctx.rect(startX, startY, endX - startX, endY - startY);
                ctx.stroke();
                actuallyDrew = true; // 描画した
            }
        } else if (currentTool === 'circle') {
            const radius = Math.hypot(endX - startX, endY - startY);
            if (radius > 0) { // 半径がゼロでないか
                ctx.arc(startX, startY, radius, 0, Math.PI * 2);
                ctx.stroke();
                actuallyDrew = true; // 描画した
            }
        }
    }
    // ペン/消しゴムの場合、mousemove中に描画済み
    // クリックしただけ（移動なし）の場合もstartPositionで点描画済み
    else if (currentTool === 'pen' || currentTool === 'eraser') {
        // startPositionで点を描画しているので、mouseupだけでも描画とみなす
        // (厳密にはmousemoveがあったかどうかも判定できるが、シンプルにする)
        actuallyDrew = true;
    }

    // 描画後の状態をローカルストレージに保存
    saveLocal();

    // 実際に描画が行われた場合のみ、その状態を履歴に保存
    if (actuallyDrew) {
        saveState();
    }

    // Undo/Redoボタンの状態更新 (saveState内で行うので不要かも)
    // updateUndoRedoButtons();
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

// ツール選択ボタン
penBtn.addEventListener('click', () => setActiveTool('pen'));
lineBtn.addEventListener('click', () => setActiveTool('line'));
rectBtn.addEventListener('click', () => setActiveTool('rect'));
circleBtn.addEventListener('click', () => setActiveTool('circle'));
eraserBtn.addEventListener('click', () => setActiveTool('eraser')); // 消しゴムはツールとして選択

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
    const oldImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const newWidth = parseInt(widthInput.value);
    const newHeight = parseInt(heightInput.value);

    // 各要素のリサイズ
    canvasContainer.style.width = newWidth + 'px';
    canvasContainer.style.height = newHeight + 'px';
    canvas.width = newWidth;
    canvas.height = newHeight;
    previewCanvas.width = newWidth;
    previewCanvas.height = newHeight;

    // 内容を復元
    ctx.putImageData(oldImageData, 0, 0);

    saveLocal();
    saveState(); // リサイズ時にも状態を保存
    updateUndoRedoButtons(); // ボタン状態は更新
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

// --- 初期化実行 ---
initializeCanvas();