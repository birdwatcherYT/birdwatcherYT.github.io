// --- DOM要素の取得 ---
const statusContainer = document.getElementById("status-container");
const statusText = document.getElementById("status-text");
const fileInput = document.getElementById("file-input");
const imagePreview = document.getElementById("image-preview");
const convertButton = document.getElementById("convert-button");
const svgPreviewContainer = document.getElementById("svg-preview-container");
const svgPreviewImg = document.getElementById("svg-preview-img");
const downloadButton = document.getElementById("download-button");

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
  // Web Workerを作成
  worker = new Worker("worker.js");

  // ワーカーからのメッセージを待ち受ける
  worker.onmessage = (event) => {
    const { type, payload } = event.data;

    switch (type) {
      case "status":
        // ワーカーからの進捗状況をUIに表示
        showStatus(payload.message);
        break;
      case "ready":
        // ワーカーの準備が完了した
        hideStatus();
        console.log("Pyodide (Worker) is ready.");
        // ここで初めてファイル入力が可能になる
        fileInput.disabled = false;
        break;
      case "result":
        // 変換が成功した
        hideStatus();
        displayResult(payload.svgData, payload.fileName);
        convertButton.disabled = false;
        break;
      case "error":
        // エラーが発生した
        hideStatus();
        alert(`エラーが発生しました: ${payload.message}`);
        console.error(payload.message);
        convertButton.disabled = false;
        break;
    }
  };
});

function displayResult(svgData, fileName) {
  const blob = new Blob([svgData], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);

  svgPreviewImg.src = url;
  downloadButton.href = url;
  downloadButton.download = fileName;

  svgPreviewContainer.style.display = "block";
  downloadButton.style.display = "inline-block";
}

// --- UIイベントリスナー ---

// スライダーの値表示を更新
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
  fileInput.disabled = true; // プレビュー表示中に再度変更されるのを防ぐ
  if (e.target.files && e.target.files[0]) {
    uploadedFile = e.target.files[0];
    uploadedFileName = uploadedFile.name;
    const reader = new FileReader();
    reader.onload = (event) => {
      imagePreview.src = event.target.result;
      imagePreview.style.display = "block";
      convertButton.disabled = false;
      convertButton.textContent = "SVGに変換";
      fileInput.disabled = false;
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

    // UIからパラメータを収集
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

    // ワーカーに処理を依頼するメッセージを送信
    // ArrayBufferはコピーされずに転送されるため効率的
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
    ); // 第2引数で所有権を移譲
  };
  reader.readAsArrayBuffer(uploadedFile);
});
