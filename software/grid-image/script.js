document.addEventListener('DOMContentLoaded', () => {
    // UI要素の取得
    const createGridBtn = document.getElementById('create-grid');
    const exportImageBtn = document.getElementById('export-image');
    const gridContainer = document.getElementById('grid-container');
    const gridGapInput = document.getElementById('grid-gap');
    const gridColorInput = document.getElementById('grid-color');
    const root = document.documentElement;
    const clampToggle = document.getElementById('clamp-toggle');

    const CELL_SIZE = 250;

    // --- グリッド線のスタイルをリアルタイムで更新 ---
    gridGapInput.addEventListener('input', (e) => {
        root.style.setProperty('--grid-gap', `${e.target.value}px`);
    });

    gridColorInput.addEventListener('input', (e) => {
        root.style.setProperty('--grid-color', e.target.value);
    });

    // --- グリッド作成処理 ---
    const createGrid = () => {
        const rows = document.getElementById('rows').value;
        const cols = document.getElementById('cols').value;
        gridContainer.innerHTML = '';
        gridContainer.style.gridTemplateRows = `repeat(${rows}, ${CELL_SIZE}px)`;
        gridContainer.style.gridTemplateColumns = `repeat(${cols}, ${CELL_SIZE}px)`;
        for (let i = 0; i < rows * cols; i++) {
            setupGridItem();
        }
    };

    // --- 個々のセルをセットアップする関数 ---
    const setupGridItem = () => {
        const gridItem = document.createElement('div');
        gridItem.classList.add('grid-item');
        const imageContainer = document.createElement('div');
        imageContainer.classList.add('image-container');
        const img = document.createElement('img');
        imageContainer.appendChild(img);
        const controls = document.createElement('div');
        controls.classList.add('item-controls');
        const fileInputId = `file-${Math.random().toString(36).substr(2, 9)}`;
        controls.innerHTML = `
            <label for="${fileInputId}">画像を選択</label>
            <input type="file" id="${fileInputId}" accept="image/*">
            <input type="range" min="0.1" max="3" step="0.01" value="1" class="scale-slider">
        `;
        gridItem.appendChild(imageContainer);
        gridItem.appendChild(controls);
        gridContainer.appendChild(gridItem);

        const fileInput = controls.querySelector('input[type="file"]');
        const scaleSlider = controls.querySelector('.scale-slider');

        const state = {
            scale: 1, translateX: 0, translateY: 0,
            naturalWidth: 0, naturalHeight: 0, initialScale: 0,
        };

        const updateTransform = () => {
            img.style.transform = `translate(-50%, -50%) translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`;
        };

        const clampTranslate = () => {
            const scaledWidth = state.naturalWidth * state.scale;
            const scaledHeight = state.naturalHeight * state.scale;
            const maxX = Math.max(0, (scaledWidth - CELL_SIZE) / 2);
            const maxY = Math.max(0, (scaledHeight - CELL_SIZE) / 2);
            state.translateX = Math.max(-maxX, Math.min(maxX, state.translateX));
            state.translateY = Math.max(-maxY, Math.min(maxY, state.translateY));
        };

        // スライダーの範囲を更新する関数
        const updateSliderRange = () => {
            if (state.initialScale === 0) return; // 画像がなければ何もしない
            if (clampToggle.checked) {
                scaleSlider.min = state.initialScale;
            } else {
                // フリーモードではもっと縮小できるように
                scaleSlider.min = 0.1;
            }
            scaleSlider.max = state.initialScale * 4;
        };

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                const tempImage = new Image();
                tempImage.onload = () => {
                    state.naturalWidth = tempImage.naturalWidth;
                    state.naturalHeight = tempImage.naturalHeight;
                    const scaleX = CELL_SIZE / state.naturalWidth;
                    const scaleY = CELL_SIZE / state.naturalHeight;
                    state.initialScale = Math.max(scaleX, scaleY);
                    state.scale = state.initialScale;
                    state.translateX = 0; state.translateY = 0;

                    updateSliderRange(); // スライダー範囲を更新
                    scaleSlider.value = state.scale;
                    img.src = event.target.result;
                    img.classList.add('loaded');
                    updateTransform();
                };
                tempImage.src = event.target.result;
            };
            reader.readAsDataURL(file);
        });

        scaleSlider.addEventListener('input', (e) => {
            state.scale = parseFloat(e.target.value);
            if (clampToggle.checked) clampTranslate();
            updateTransform();
        });

        let isDragging = false, startX, startY, initialTx, initialTy;
        imageContainer.addEventListener('mousedown', (e) => {
            if (!img.src) return; e.preventDefault();
            isDragging = true; startX = e.clientX; startY = e.clientY;
            initialTx = state.translateX; initialTy = state.translateY;
            imageContainer.style.cursor = 'grabbing';
        });
        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            state.translateX = initialTx + (e.clientX - startX);
            state.translateY = initialTy + (e.clientY - startY);
            if (clampToggle.checked) clampTranslate();
            updateTransform();
        });
        window.addEventListener('mouseup', () => {
            if (isDragging) { isDragging = false; imageContainer.style.cursor = 'grab'; }
        });

        // 各要素に固有の関数と状態を関連付ける
        gridItem.state = state;
        gridItem.updateSliderRange = updateSliderRange;
        gridItem.clampTranslate = clampTranslate;
        gridItem.updateTransform = updateTransform;
    };

    // モード切替時に全要素のスライダーと状態を更新する
    clampToggle.addEventListener('change', () => {
        gridContainer.querySelectorAll('.grid-item').forEach(gridItem => {
            if (gridItem.state && gridItem.state.initialScale > 0) {
                // スライダーの最小値を更新
                gridItem.updateSliderRange();

                // 制限モードをONにした場合
                if (clampToggle.checked) {
                    const state = gridItem.state;
                    const scaleSlider = gridItem.querySelector('.scale-slider');
                    // もし現在の倍率が最小値を下回っていたら、最小値にリセット
                    if (state.scale < state.initialScale) {
                        state.scale = state.initialScale;
                        scaleSlider.value = state.scale;
                    }
                    // 位置を再制限して更新
                    gridItem.clampTranslate();
                    gridItem.updateTransform();
                }
            }
        });
    });

    // --- 画像出力処理 (変更なし) ---
    const exportImage = async () => {
        const exportWidth = parseInt(document.getElementById('export-width').value, 10);
        if (isNaN(exportWidth) || exportWidth <= 0) { alert('有効な出力幅を入力してください。'); return; }
        const clone = gridContainer.cloneNode(true);
        clone.querySelectorAll('.item-controls').forEach(el => el.remove());
        clone.style.position = 'absolute';
        clone.style.top = '0';
        clone.style.left = '-9999px';
        document.body.appendChild(clone);
        const originalWidth = gridContainer.offsetWidth;
        const scaleRatio = exportWidth / originalWidth;
        clone.style.transform = `scale(${scaleRatio})`;
        clone.style.transformOrigin = 'top left';
        try {
            const canvas = await html2canvas(clone, {
                width: clone.offsetWidth * scaleRatio,
                height: clone.offsetHeight * scaleRatio,
                scale: 1, allowTaint: true, useCORS: true, backgroundColor: 'transparent',
            });
            const image = canvas.toDataURL('image/png');
            const downloadLink = document.getElementById('download-link');
            downloadLink.href = image;
            downloadLink.download = 'grid-image.png';
            downloadLink.click();
        } catch (err) {
            console.error('画像の出力に失敗しました。', err);
            alert('画像の出力に失敗しました。コンソールログを確認してください。');
        } finally {
            document.body.removeChild(clone);
        }
    };

    createGridBtn.addEventListener('click', createGrid);
    exportImageBtn.addEventListener('click', exportImage);

    // 初期グリッドを作成
    createGrid();
});