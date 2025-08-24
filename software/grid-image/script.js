document.addEventListener('DOMContentLoaded', () => {
    // UI要素の取得
    const createGridBtn = document.getElementById('create-grid');
    const exportImageBtn = document.getElementById('export-image');
    const gridContainer = document.getElementById('grid-container');
    const gridGapInput = document.getElementById('grid-gap');
    const gridColorInput = document.getElementById('grid-color');
    const root = document.documentElement;

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
            <input type="range" min="1" max="3" step="0.01" value="1" class="scale-slider">
        `;

        gridItem.appendChild(imageContainer);
        gridItem.appendChild(controls);
        gridContainer.appendChild(gridItem);

        const fileInput = controls.querySelector('input[type="file"]');
        const scaleSlider = controls.querySelector('.scale-slider');

        const state = { scale: 1, translateX: 0, translateY: 0 };

        const updateTransform = () => {
            img.style.transform = `translate(-50%, -50%) translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`;
        };

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                const tempImage = new Image();
                tempImage.onload = () => {
                    const scaleX = CELL_SIZE / tempImage.naturalWidth;
                    const scaleY = CELL_SIZE / tempImage.naturalHeight;
                    const initialScale = Math.max(scaleX, scaleY);

                    state.scale = initialScale;
                    state.translateX = 0;
                    state.translateY = 0;

                    scaleSlider.min = initialScale * 0.5;
                    scaleSlider.max = initialScale * 3;
                    scaleSlider.value = initialScale;

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
            updateTransform();
        });

        let isDragging = false, startX, startY, initialTx, initialTy;
        imageContainer.addEventListener('mousedown', (e) => {
            if (!img.src) return;
            e.preventDefault();
            isDragging = true;
            startX = e.clientX; startY = e.clientY;
            initialTx = state.translateX; initialTy = state.translateY;
            imageContainer.style.cursor = 'grabbing';
        });
        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            state.translateX = initialTx + (e.clientX - startX);
            state.translateY = initialTy + (e.clientY - startY);
            updateTransform();
        });
        window.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                imageContainer.style.cursor = 'grab';
            }
        });
    };

    // --- 画像出力処理 (ちらつき防止版) ---
    const exportImage = async () => {
        const exportWidth = parseInt(document.getElementById('export-width').value, 10);
        if (isNaN(exportWidth) || exportWidth <= 0) {
            alert('有効な出力幅を入力してください。');
            return;
        }

        // 1. グリッドのクローンを作成
        const clone = gridContainer.cloneNode(true);

        // クローンからコントロールUIを削除
        clone.querySelectorAll('.item-controls').forEach(el => el.remove());

        // 2. クローンを画面外に配置
        clone.style.position = 'absolute';
        clone.style.top = '0';
        clone.style.left = '-9999px'; // 画面外に飛ばす
        document.body.appendChild(clone);

        // 3. スケール比を計算し、クローンに適用
        const originalWidth = gridContainer.offsetWidth;
        const scaleRatio = exportWidth / originalWidth;

        clone.style.transform = `scale(${scaleRatio})`;
        clone.style.transformOrigin = 'top left';

        try {
            // 4. スケールしたクローンをキャプチャ
            const canvas = await html2canvas(clone, {
                width: clone.offsetWidth * scaleRatio,
                height: clone.offsetHeight * scaleRatio,
                scale: 1, // DOM自体をスケールしたので、canvasのスケールは1
                allowTaint: true,
                useCORS: true,
                backgroundColor: 'transparent',
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
            // 5. 後片付けとしてクローンを削除
            document.body.removeChild(clone);
        }
    };

    createGridBtn.addEventListener('click', createGrid);
    exportImageBtn.addEventListener('click', exportImage);

    // 初期グリッドを作成
    createGrid();
});
