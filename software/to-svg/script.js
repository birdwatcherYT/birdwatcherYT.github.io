// --- DOM要素の取得 ---
const statusContainer = document.getElementById("status-container");
const statusText = document.getElementById("status-text");
const fileInput = document.getElementById("file-input");
const imagePreview = document.getElementById("image-preview");
const convertButton = document.getElementById("convert-button");
const svgPreviewContainer = document.getElementById("svg-preview-container");
const svgPreviewImg = document.getElementById("svg-preview-img");
const downloadSvgButton = document.getElementById("download-svg-button");
const downloadPngButton = document.getElementById("download-png-button");

let uploadedFile = null;
let uploadedFileName = "image.png";

function showStatus(message) {
  statusText.innerText = message;
  statusContainer.style.display = "block";
}

function hideStatus() {
  statusContainer.style.display = "none";
}

// --- Web Workerのセットアップ ---
let worker;

document.addEventListener("DOMContentLoaded", () => {
  showStatus("実行環境の準備を開始します...");
  worker = new Worker("worker.js");

  worker.onmessage = (event) => {
    const { type, payload } = event.data;

    switch (type) {
      case "status":
        showStatus(payload.message);
        break;
      case "ready":
        hideStatus();
        console.log("Pyodide (Worker) is ready.");
        fileInput.disabled = false;
        break;
      case "result":
        hideStatus();
        displayResult(payload);
        convertButton.disabled = false;
        break;
      case "error":
        hideStatus();
        alert(`エラーが発生しました: ${payload.message}`);
        console.error(payload.message);
        convertButton.disabled = false;
        break;
    }
  };
});

function displayResult({ svgData, pngData, svgFileName, pngFileName }) {
  // SVGプレビューとダウンロードリンクの設定
  const svgBlob = new Blob([svgData], { type: "image/svg+xml" });
  const svgUrl = URL.createObjectURL(svgBlob);
  svgPreviewImg.src = svgUrl;
  downloadSvgButton.href = svgUrl;
  downloadSvgButton.download = svgFileName;

  // PNGダウンロードリンクの設定
  const pngBlob = new Blob([pngData], { type: "image/png" });
  const pngUrl = URL.createObjectURL(pngBlob);
  downloadPngButton.href = pngUrl;
  downloadPngButton.download = pngFileName;

  // 結果コンテナとダウンロードボタンを表示
  svgPreviewContainer.style.display = "block";
  downloadSvgButton.style.display = "inline-block";
  downloadPngButton.style.display = "inline-block";
}

// --- UIイベントリスナー ---
const setupRangeValueDisplay = (rangeId, valueId, decimals = 0) => {
  const range = document.getElementById(rangeId);
  const value = document.getElementById(valueId);
  if (range && value)
    range.addEventListener("input", () => {
      value.textContent = parseFloat(range.value).toFixed(decimals);
    });
};
[
  "epsilon-factor",
  "max-side-length",
  "num-colors",
  "median-blur-ksize",
  "gaussian-blur-ksize",
  "dilate-iterations",
  "stroke-width",
].forEach((id) => {
  setupRangeValueDisplay(
    id,
    `${id}-value`,
    id === "epsilon-factor" ? 4 : id === "stroke-width" ? 1 : 0
  );
});

fileInput.addEventListener("change", (e) => {
  fileInput.disabled = true;
  if (e.target.files && e.target.files[0]) {
    uploadedFile = e.target.files[0];
    uploadedFileName = uploadedFile.name;
    const reader = new FileReader();
    reader.onload = (event) => {
      imagePreview.src = event.target.result;
      imagePreview.style.display = "block";
      convertButton.disabled = false;
      convertButton.textContent = "変換実行";
      fileInput.disabled = false;
      // 新しい画像をアップロードしたら、前の結果を隠す
      svgPreviewContainer.style.display = "none";
      downloadSvgButton.style.display = "none";
      downloadPngButton.style.display = "none";
    };
    reader.readAsDataURL(uploadedFile);
  } else {
    fileInput.disabled = false;
  }
});

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

convertButton.addEventListener("click", () => {
  if (!uploadedFile || !worker) {
    alert("ファイルをアップロードしてください。");
    return;
  }

  convertButton.disabled = true;
  showStatus("画像データを処理スレッドに転送中...");

  const reader = new FileReader();
  reader.onload = (event) => {
    const arrayBuffer = event.target.result;

    const params = {
      num_colors: parseInt(document.getElementById("num-colors").value, 10),
      apply_sharpening: document.getElementById("apply-sharpening").checked,
      median_blur_ksize: parseInt(
        document.getElementById("median-blur-ksize").value,
        10
      ),
      dilate_iterations: parseInt(
        document.getElementById("dilate-iterations").value,
        10
      ),
      epsilon_factor: parseFloat(
        document.getElementById("epsilon-factor").value
      ),
      bg_color: hexToRgb(document.getElementById("bg-color").value),
      apply_resizing: document.getElementById("apply-resizing").checked,
      max_side_length: parseInt(
        document.getElementById("max-side-length").value,
        10
      ),
      gaussian_blur_ksize: parseInt(
        document.getElementById("gaussian-blur-ksize").value,
        10
      ),
      add_stroke: document.getElementById("add-stroke").checked,
      stroke_color: hexToRgb(document.getElementById("stroke-color").value),
      stroke_width: parseFloat(document.getElementById("stroke-width").value),
    };

    worker.postMessage(
      {
        type: "convert",
        payload: {
          fileName: uploadedFileName,
          fileData: arrayBuffer,
          params: params,
        },
      },
      [arrayBuffer]
    );
  };
  reader.readAsArrayBuffer(uploadedFile);
});