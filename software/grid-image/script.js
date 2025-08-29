document.addEventListener('DOMContentLoaded', () => {
    // UI要素の取得
    const createGridBtn = document.getElementById('create-grid');
    const exportImageBtn = document.getElementById('export-image');
    const gridContainer = document.getElementById('grid-container');
    const gridGapInput = document.getElementById('grid-gap');
    const gridColorInput = document.getElementById('grid-color');
    const root = document.documentElement;
    const clampToggle = document.getElementById('clamp-toggle');
    const rowsInput = document.getElementById('rows');
    const colsInput = document.getElementById('cols');

    const CELL_SIZE = 250; // 基本サイズ
    let rowHeights, colWidths;

    // --- 全てのセルのスケール基準値と表示を更新する関数 ---
    const updateAllItemsDisplay = () => {
        document.querySelectorAll('.grid-item').forEach(item => {
            if (item.recalculateScales) {
                item.recalculateScales();
            }
            if (clampToggle.checked && item.clampTranslate) {
                item.clampTranslate();
                item.updateTransform();
            }
        });
    };

    // --- グリッド線のスタイルをリアルタイムで更新 ---
    gridGapInput.addEventListener('input', (e) => {
        root.style.setProperty('--grid-gap', `${e.target.value}px`);
    });

    gridColorInput.addEventListener('input', (e) => {
        root.style.setProperty('--grid-color', e.target.value);
    });

    // --- グリッド作成処理 ---
    const createGrid = () => {
        const existingItems = [];
        gridContainer.querySelectorAll('.grid-item').forEach(item => {
            const img = item.querySelector('img');
            if (img && img.src && item.state) {
                existingItems.push({ src: img.src, state: item.state });
            } else {
                existingItems.push(null);
            }
        });

        const rows = parseInt(rowsInput.value, 10);
        const cols = parseInt(colsInput.value, 10);
        gridContainer.innerHTML = '';

        rowHeights = new Array(rows).fill(CELL_SIZE);
        colWidths = new Array(cols).fill(CELL_SIZE);
        gridContainer.style.gridTemplateColumns = colWidths.map(w => `${w}px`).join(' ');
        gridContainer.style.gridTemplateRows = rowHeights.map(h => `${h}px`).join(' ');

        const newCellCount = rows * cols;
        for (let i = 0; i < newCellCount; i++) {
            setupGridItem(existingItems[i] || null);
        }
    };

    // --- 個々のセルをセットアップする関数 ---
    const setupGridItem = (initialData) => {
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
            <div class="button-group">
                <button class="fit-btn">フィット</button>
                <button class="fill-btn">全表示</button>
            </div>
            <div class="button-group">
                <button class="align-h-btn">横調整</button>
                <button class="align-v-btn">縦調整</button>
            </div>
            <input type="range" min="0.1" max="3" step="0.01" value="1" class="scale-slider">
        `;
        gridItem.appendChild(imageContainer);
        gridItem.appendChild(controls);
        gridContainer.appendChild(gridItem);

        const fileInput = controls.querySelector('input[type="file"]');
        const scaleSlider = controls.querySelector('.scale-slider');
        const fitBtn = controls.querySelector('.fit-btn');
        const fillBtn = controls.querySelector('.fill-btn');
        const alignHBtn = controls.querySelector('.align-h-btn');
        const alignVBtn = controls.querySelector('.align-v-btn');

        const state = {
            scale: 1, translateX: 0, translateY: 0,
            naturalWidth: 0, naturalHeight: 0,
            fitScale: 0, fillScale: 0,
        };
        gridItem.state = state;

        const updateTransform = () => {
            img.style.transform = `translate(-50%, -50%) translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`;
        };

        const clampTranslate = () => {
            const cellWidth = gridItem.offsetWidth;
            const cellHeight = gridItem.offsetHeight;
            const scaledWidth = state.naturalWidth * state.scale;
            const scaledHeight = state.naturalHeight * state.scale;
            const maxX = Math.max(0, (scaledWidth - cellWidth) / 2);
            const maxY = Math.max(0, (scaledHeight - cellHeight) / 2);
            state.translateX = Math.max(-maxX, Math.min(maxX, state.translateX));
            state.translateY = Math.max(-maxY, Math.min(maxY, state.translateY));
        };

        const updateSliderRange = () => {
            if (state.fitScale === 0) return;
            // 「移動範囲を制限する」の設定に関わらず、スライダーの下限は常に固定値とする
            scaleSlider.min = 0.1;
            scaleSlider.max = state.fitScale * 4;
        };

        const recalculateScales = () => {
            if (state.naturalWidth === 0 || gridItem.offsetWidth === 0) return;
            const cellWidth = gridItem.offsetWidth;
            const cellHeight = gridItem.offsetHeight;
            const scaleX = cellWidth / state.naturalWidth;
            const scaleY = cellHeight / state.naturalHeight;
            state.fitScale = Math.max(scaleX, scaleY);
            state.fillScale = Math.min(scaleX, scaleY);
            updateSliderRange();
        };
        gridItem.recalculateScales = recalculateScales;

        const loadImage = (imageSrc, existingState = null) => {
            const tempImage = new Image();
            tempImage.onload = () => {
                state.naturalWidth = tempImage.naturalWidth;
                state.naturalHeight = tempImage.naturalHeight;

                setTimeout(() => {
                    recalculateScales();

                    if (existingState) {
                        Object.assign(state, existingState);
                    } else {
                        state.scale = state.fitScale;
                        state.translateX = 0;
                        state.translateY = 0;
                    }

                    scaleSlider.value = state.scale;
                    img.src = imageSrc;
                    img.classList.add('loaded');

                    if (clampToggle.checked) clampTranslate();
                    updateTransform();
                }, 50);
            };
            tempImage.src = imageSrc;
        };

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => loadImage(event.target.result);
            reader.readAsDataURL(file);
        });

        scaleSlider.addEventListener('input', (e) => {
            state.scale = parseFloat(e.target.value);
            if (clampToggle.checked) clampTranslate();
            updateTransform();
        });

        fitBtn.addEventListener('click', () => {
            if (!img.src) return;
            state.scale = state.fitScale;
            state.translateX = 0;
            state.translateY = 0;
            scaleSlider.value = state.scale;
            updateTransform();
        });

        fillBtn.addEventListener('click', () => {
            if (!img.src) return;
            state.scale = state.fillScale;
            state.translateX = 0;
            state.translateY = 0;
            scaleSlider.value = state.scale;
            updateTransform();
        });

        alignVBtn.addEventListener('click', () => {
            if (!img.src) return;
            const scaledHeight = state.naturalHeight * state.scale;
            const items = Array.from(gridContainer.children);
            const index = items.indexOf(gridItem);
            const cols = parseInt(colsInput.value, 10);
            const rowIndex = Math.floor(index / cols);

            rowHeights[rowIndex] = scaledHeight;
            gridContainer.style.gridTemplateRows = rowHeights.map(h => `${h.toFixed(2)}px`).join(' ');

            setTimeout(updateAllItemsDisplay, 50);
        });

        alignHBtn.addEventListener('click', () => {
            if (!img.src) return;
            const scaledWidth = state.naturalWidth * state.scale;
            const items = Array.from(gridContainer.children);
            const index = items.indexOf(gridItem);
            const cols = parseInt(colsInput.value, 10);
            const colIndex = index % cols;

            colWidths[colIndex] = scaledWidth;
            gridContainer.style.gridTemplateColumns = colWidths.map(w => `${w.toFixed(2)}px`).join(' ');

            setTimeout(updateAllItemsDisplay, 50);
        });


        let isDragging = false, startX, startY, initialTx, initialTy;
        const getEventPosition = (e) => e.touches?.[0] || e;

        const onDragStart = (e) => {
            if (!img.src) return;
            if (e.type === 'mousedown') e.preventDefault();
            isDragging = true;
            const pos = getEventPosition(e);
            startX = pos.clientX;
            startY = pos.clientY;
            initialTx = state.translateX;
            initialTy = state.translateY;
            imageContainer.style.cursor = 'grabbing';
        };

        const onDragMove = (e) => {
            if (!isDragging) return;
            if (e.type === 'touchmove') e.preventDefault();
            const pos = getEventPosition(e);
            state.translateX = initialTx + (pos.clientX - startX);
            state.translateY = initialTy + (pos.clientY - startY);
            if (clampToggle.checked) clampTranslate();
            updateTransform();
        };

        const onDragEnd = () => {
            if (isDragging) {
                isDragging = false;
                imageContainer.style.cursor = 'grab';
            }
        };

        imageContainer.addEventListener('mousedown', onDragStart);
        imageContainer.addEventListener('touchstart', onDragStart, { passive: true });
        window.addEventListener('mousemove', onDragMove);
        window.addEventListener('mouseup', onDragEnd);
        window.addEventListener('mouseleave', onDragEnd);
        window.addEventListener('touchmove', onDragMove, { passive: false });
        window.addEventListener('touchend', onDragEnd);
        window.addEventListener('touchcancel', onDragEnd);

        gridItem.clampTranslate = clampTranslate;
        gridItem.updateTransform = updateTransform;

        if (initialData?.src) {
            loadImage(initialData.src, initialData.state);
        }
    };

    clampToggle.addEventListener('change', () => {
        // チェックがオンになった場合は、全ての画像の位置を再評価して範囲内に収める
        if (clampToggle.checked) {
            gridContainer.querySelectorAll('.grid-item').forEach(gridItem => {
                if (gridItem.state?.fitScale > 0) {
                    gridItem.clampTranslate();
                    gridItem.updateTransform();
                }
            });
        }
    });

    const exportImage = async () => {
        const exportWidth = parseInt(document.getElementById('export-width').value, 10);
        if (isNaN(exportWidth) || exportWidth <= 0) { alert('有効な出力幅を入力してください。'); return; }

        const clone = gridContainer.cloneNode(true);
        clone.querySelectorAll('.item-controls').forEach(el => el.remove());
        clone.style.position = 'absolute';
        clone.style.top = '0';
        clone.style.left = '-9999px';
        clone.style.width = `${gridContainer.offsetWidth}px`;
        clone.style.height = `${gridContainer.offsetHeight}px`;
        document.body.appendChild(clone);

        const originalWidth = clone.offsetWidth;
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

    createGrid();
});