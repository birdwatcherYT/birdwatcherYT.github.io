// Pyodideのスクリプトをワーカー内に読み込む
importScripts("https://cdn.jsdelivr.net/pyodide/v0.26.1/full/pyodide.js");

let pyodide = null;

// メインスレッドにステータスを送信するヘルパー関数
function postStatus(message) {
  self.postMessage({ type: "status", payload: { message } });
}

async function setupPyodide() {
  postStatus("Pyodide (Python実行環境) を読み込んでいます...");
  pyodide = await loadPyodide();
  postStatus("必要なライブラリ (numpy, OpenCV, svgwrite) をインストール中...");
  await pyodide.loadPackage(["numpy"]);
  await pyodide.loadPackage("micropip");
  const micropip = pyodide.pyimport("micropip");
  await micropip.install(["opencv-python", "svgwrite"]);

  postStatus("Pythonスクリプトを準備中...");

  // Pythonファイルをfetchで読み込む
  const pythonFiles = ["common.py", "convert.py", "main.py"];
  const fetchPromises = pythonFiles.map((file) =>
    fetch(`python/${file}`).then((response) => {
      if (!response.ok) throw new Error(`Failed to load ${file}`);
      return response.text();
    })
  );
  const [commonCode, convertCode, mainCode] = await Promise.all(fetchPromises);

  pyodide.FS.writeFile("common.py", commonCode);
  pyodide.FS.writeFile("convert.py", convertCode);
  pyodide.FS.writeFile("main.py", mainCode);

  // 準備完了をメインスレッドに通知
  self.postMessage({ type: "ready" });
}

// ワーカーの初期化処理を実行
const pyodideReadyPromise = setupPyodide();

// メインスレッドからのメッセージを待ち受ける
self.onmessage = async (event) => {
  // まずはPyodideの初期化が完了するのを待つ
  await pyodideReadyPromise;

  const { type, payload } = event.data;

  if (type === "convert") {
    const { fileName, fileData, params } = payload;
    const inputPath = `/tmp/${fileName}`;
    const outputPath = `/tmp/${fileName.replace(/\.[^/.]+$/, ".svg")}`;

    try {
      postStatus("画像データをPython環境に転送中...");
      pyodide.FS.writeFile(inputPath, new Uint8Array(fileData), {
        encoding: "binary",
      });

      postStatus(
        "Pythonコードを実行してSVGを生成中... (時間がかかる場合があります)"
      );

      const fullParams = {
        input_path: inputPath,
        output_path: outputPath,
        ...params,
      };

      pyodide.globals.set("params", pyodide.toPy(fullParams));

      const run_script = `
import main
result = main.run_conversion(**params)
result
`;
      await pyodide.runPythonAsync(run_script);
      postStatus("SVGデータを取得中...");

      const svgData = pyodide.FS.readFile(outputPath, { encoding: "binary" });

      // 成功結果をメインスレッドに送信
      self.postMessage(
        {
          type: "result",
          payload: {
            svgData: svgData,
            fileName: outputPath.split("/").pop(),
          },
        },
        [svgData.buffer]
      ); // ArrayBufferの所有権を移譲
    } catch (error) {
      // エラーをメインスレッドに送信
      self.postMessage({ type: "error", payload: { message: error.message } });
    }
  }
};
