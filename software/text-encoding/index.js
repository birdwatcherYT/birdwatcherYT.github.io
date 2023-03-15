// npm init -y
// npm i encoding-japanese
// npx vite build
// npx vite dev

import Encoding from "encoding-japanese";

function readText(files, toEncoding, toNL) {
	for (const file of files) {
		const reader = new FileReader();
		// console.log(file)
		reader.readAsArrayBuffer(file);
		reader.onload = (e) => {
			const srcArray = new Uint8Array(e.target.result);
			let str = Encoding.convert(srcArray, { to: "UNICODE", type: "string" });
			// BOMを削除、改行置換
			str = str.replace(/^\ufeff/g, "").replaceAll(/(\r\n|\r|\n)/g, toNL);
			const converted = Encoding.convert(Encoding.stringToCode(str), { to: toEncoding, from: "UNICODE" });
			const distArray = new Uint8Array(converted);
			download(distArray, file.name);
		}
	}
}

function download(text, filename) {
	const blob = new Blob([text], { type: "text/plain" });
	const link = document.createElement("a");
	link.href = URL.createObjectURL(blob);
	link.download = filename;
	link.click();
}


document.getElementById("button").addEventListener("click", () => {
	const NEWLINES = { LF: "\n", CRLF: "\r\n", CR: "\r" };

	const file_select = document.getElementById("file_select");
	const encoding = document.getElementById("encoding");
	const newline = document.getElementById("newline");
	readText(file_select.files, encoding.value, NEWLINES[newline.value]);
});
