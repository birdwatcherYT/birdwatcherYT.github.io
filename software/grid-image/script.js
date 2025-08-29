document.addEventListener('DOMContentLoaded', () => {
    // UI要素の取得
    const createGridBtn = document.getElementById('create-grid');
    const exportImageBtn = document.getElementById('export-image');
    const gridContainer = document.getElementById('grid-container');
    const gridGapInput = document.getElementById('grid-gap');
    const gridColorInput = document.getElementById('grid-color');
    const root = document.documentElement;
    const clampToggle = document.getElementById('clamp-toggle');
    const layoutModeRadios = document.querySelectorAll('input[name="layout-mode"]');

    const CELL_SIZE = 250; // 基本サイズ
    let currentLayoutMode = 'fixed';

    // --- グリッド全体のレイアウトを更新する関数 ---
    const updateGridLayout = () => {
        if (currentLayoutMode !== 'flexible') return; // 可変モードでなければ何もしない

        const rows = parseInt(document.getElementById('rows').value, 10);
        const cols = parseInt(document.getElementById('cols').value, 10);
        if (isNaN(rows) || isNaN(cols)) return;

        const items = Array.from(gridContainer.querySelectorAll('.grid-item'));
        const rowHeights = new Array(rows).fill(CELL_SIZE);
        const colWidths = new Array(cols).fill(CELL_SIZE);

        // 各行・各列の最大サイズを計算
        items.forEach((item, index) => {
            const row = Math.floor(index / cols);
            const col = index % cols;

            // itemに保存された目標サイズ、なければデフォルトサイズ
            const itemWidth = item.targetWidth || CELL_SIZE;
            const itemHeight = item.targetHeight || CELL_SIZE;

            if (itemWidth > colWidths[col]) {
                colWidths[col] = itemWidth;
            }
            if (itemHeight > rowHeights[row]) {
                rowHeights[row] = itemHeight;
            }
        });

        // 計算した最大サイズをグリッドのテンプレートに適用
        gridContainer.style.gridTemplateColumns = colWidths.map(w => `${w}px`).join(' ');
        gridContainer.style.gridTemplateRows = rowHeights.map(h => `${h}px`).join(' ');
    };

    // --- レイアウトモード切替処理 ---
    layoutModeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            currentLayoutMode = e.target.value;
            createGrid();
        });
    });

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
                existingItems.push({
                    src: img.src,
                    state: item.state,
                });
            } else {
                existingItems.push(null);
            }
        });

        const rows = document.getElementById('rows').value;
        const cols = document.getElementById('cols').value;
        gridContainer.innerHTML = '';

        // グリッドのテンプレートを初期化
        gridContainer.style.gridTemplateColumns = `repeat(${cols}, ${CELL_SIZE}px)`;
        gridContainer.style.gridTemplateRows = `repeat(${rows}, ${CELL_SIZE}px)`;

        const newCellCount = rows * cols;
        for (let i = 0; i < newCellCount; i++) {
            setupGridItem(existingItems[i] || null);
        }

        // モード切替時にレイアウトを再計算
        setTimeout(updateGridLayout, 50);
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
            if (state.initialScale === 0) return;
            if (clampToggle.checked) {
                scaleSlider.min = state.initialScale;
            } else {
                scaleSlider.min = 0.1;
            }
            scaleSlider.max = state.initialScale * 4;
        };

        const loadImage = (imageSrc, existingState = null) => {
            const tempImage = new Image();
            tempImage.onload = () => {
                state.naturalWidth = tempImage.naturalWidth;
                state.naturalHeight = tempImage.naturalHeight;

                // === ここからが修正箇所 ===
                if (currentLayoutMode === 'flexible') {
                    const aspectRatio = state.naturalWidth / state.naturalHeight;
                    if (aspectRatio >= 1) { // 横長または正方形の画像
                        gridItem.targetWidth = CELL_SIZE * aspectRatio;
                        gridItem.targetHeight = CELL_SIZE;
                    } else { // 縦長の画像
                        gridItem.targetWidth = CELL_SIZE;
                        gridItem.targetHeight = CELL_SIZE / aspectRatio;
                    }
                } else { // 固定モード
                    gridItem.targetWidth = CELL_SIZE;
                    gridItem.targetHeight = CELL_SIZE;
                }
                // === ここまでが修正箇所 ===

                // グリッド全体のレイアウトを更新
                updateGridLayout();

                // DOM更新（セルサイズ変更）を待つための遅延
                setTimeout(() => {
                    const cellWidth = gridItem.offsetWidth;
                    const cellHeight = gridItem.offsetHeight;
                    const scaleX = cellWidth / state.naturalWidth;
                    const scaleY = cellHeight / state.naturalHeight;
                    state.initialScale = Math.max(scaleX, scaleY);

                    if (existingState) {
                        Object.assign(state, existingState);
                        state.initialScale = Math.max(scaleX, scaleY);
                        if (clampToggle.checked && state.scale < state.initialScale) {
                            state.scale = state.initialScale;
                        }
                    } else {
                        state.scale = state.initialScale;
                        state.translateX = 0; state.translateY = 0;
                    }

                    updateSliderRange();
                    scaleSlider.value = state.scale;
                    img.src = imageSrc;
                    img.classList.add('loaded');

                    if (clampToggle.checked) clampTranslate();
                    updateTransform();
                }, 100);
            };
            tempImage.src = imageSrc;
        };

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                loadImage(event.target.result);
            };
            reader.readAsDataURL(file);
        });

        scaleSlider.addEventListener('input', (e) => {
            state.scale = parseFloat(e.target.value);
            if (clampToggle.checked) clampTranslate();
            updateTransform();
        });

        let isDragging = false, startX, startY, initialTx, initialTy;

        const getEventPosition = (e) => {
            if (e.touches && e.touches.length > 0) {
                return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
            }
            return { clientX: e.clientX, clientY: e.clientY };
        };

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

        gridItem.updateSliderRange = updateSliderRange;
        gridItem.clampTranslate = clampTranslate;
        gridItem.updateTransform = updateTransform;

        if (initialData && initialData.src) {
            loadImage(initialData.src, initialData.state);
        }
    };

    clampToggle.addEventListener('change', () => {
        gridContainer.querySelectorAll('.grid-item').forEach(gridItem => {
            if (gridItem.state && gridItem.state.initialScale > 0) {
                gridItem.updateSliderRange();
                if (clampToggle.checked) {
                    const state = gridItem.state;
                    const scaleSlider = gridItem.querySelector('.scale-slider');
                    if (state.scale < state.initialScale) {
                        state.scale = state.initialScale;
                        scaleSlider.value = state.scale;
                    }
                    gridItem.clampTranslate();
                    gridItem.updateTransform();
                }
            }
        });
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