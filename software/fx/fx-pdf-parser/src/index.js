// npm init -y
// npm i vite
// npm i pdfjs-dist
// npm i encoding-japanese
// npx vite build

import { GlobalWorkerOptions, getDocument, version } from "pdfjs-dist";
import Encoding from "encoding-japanese";

const pdfjsDistBaseURL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}`;
GlobalWorkerOptions.workerSrc = pdfjsDistBaseURL + "/build/pdf.worker.js";

document.querySelector("#file_select").addEventListener("change", () => {
	let status= document.getElementById("status");
	status.textContent = "";
});

document.querySelector("#convert").addEventListener("click", async () => {
	let file_select= document.getElementById("file_select");
	let status= document.getElementById("status");
	let files = file_select.files;
	file_select.disabled = true;
	let records=[];
	for(let i = 0 ; i < files.length ; i++){
		status.textContent = i+"/"+files.length;
		let words = await pdf2txt(files[i]);
		let record = txt2record(words);
		records.push(record);
	}
	status.textContent = "完了";
	save_as_csv(records);
	file_select.disabled = false;
});

async function pdf2txt(file){
	if (!file) return;
	const fileData = await new Promise((r) => {
		const fileReader = new FileReader();
		fileReader.onload = () => {
			r(fileReader.result);
		};
		fileReader.readAsArrayBuffer(file);
	});
	const loadingTask = getDocument({
		data: fileData,
		isEvalSupported: false,
		disableFontFace: true,
		cMapUrl: pdfjsDistBaseURL + "/cmaps/",
		cMapPacked: true,
	});
	const pdfDocument = await loadingTask.promise;
	const chunks = [];
	for (let i = 1; i <= pdfDocument.numPages; i++) {
		const page = await pdfDocument.getPage(i);
		const textContent = await page.getTextContent();
		for (let j=0;j<textContent.items.length; j++){
			if (textContent.items[j].height!=0)
				chunks.push(textContent.items[j].str);
		}
		page.cleanup();
	}
	await loadingTask.destroy();
	return chunks;
}

function txt2record(words){
	const Mode = {
		NONE: -1,
		DATE: 0,
		ACCOUNT_STATE: 1,
		DETAIL: 2,
		INOUT: 3,
		INOUT_SUM: 4
	};

	let mode = Mode.NONE;
	let currency_pair = null;

	let date = null;
	let account_columns = [
		"預託証拠金",
		"(内)ポジション",
		"評価損益",
		"(内)スワップ",
		"受渡前損益",
		"有効証拠金",
		"総必要証拠金",
		"(内)必要証拠金",
		"出金予約額",
		"出金可能額",
	];
	let account_values = [];
	let inout_columns = ["入出金", "売買損益", "スワップ損益", "その他", "総合計", "スワップ振替"];
	let inout_values = [];

	for (let i=0;i<words.length; i++){
		let line=words[i];
		// console.log(line);
		// モード切り替え
		if ("【取引日】" == line){
			if (date == null){
				mode = Mode.DATE;
			}
		}else if ("【口座状況】" == line){
			mode = Mode.ACCOUNT_STATE;
		}else if ("未決済金額" == line){
			mode = Mode.NONE;
		}else if ("新規決済区分" == line){
			mode = Mode.DETAIL;
		}else if ("入出金" == line){
			mode = Mode.INOUT;
		}else if (mode == Mode.INOUT && "合計" == line){
			mode = Mode.INOUT_SUM;
		}
		// モード使用
		else if (mode == Mode.DATE){
			date = line.replaceAll("/", "-");
			mode = Mode.NONE;
		}else if (mode == Mode.ACCOUNT_STATE){
			let num = to_int(line.replaceAll(",", ""))
			if (num != null)
				account_values.push(num);
			if (account_values.length >= account_columns.length)
				mode = Mode.NONE;
		}else if (mode == Mode.INOUT_SUM){
			let num = to_int(line.replaceAll(",", ""));
			if (num != null)
				inout_values.push(num);
			if (inout_values.length >= inout_columns.length)
				mode = Mode.NONE;
		}
	}
	if (inout_values.length == 0)
		inout_values = [...Array(inout_columns.length)].map(() => 0);

	console.assert(date!=null);
	console.assert(account_columns.length == account_values.length);
	console.assert(inout_columns.length == inout_values.length);

	let record = {"日付": date};
	for (let i=0;i<account_columns.length;++i)
		record[account_columns[i]]=account_values[i];
	for (let i=0;i<inout_columns.length;++i)
		record[inout_columns[i]]=inout_values[i];
	
	return record
}

function to_int(text) {
	if (/^[-+]?\d+$/.test(text)) {
		return Number(text);
	} else {
		return null;
	}
}

function save_as_csv(records){
	let order = [
		"日付",
		"預託証拠金",
		"評価損益",
		"(内)ポジション",
		"(内)スワップ",
		"受渡前損益",
		"有効証拠金",
		"総必要証拠金",
		"(内)必要証拠金",
		"出金予約額",
		"出金可能額",
		"入出金",
		"売買損益",
		"スワップ損益",
		"スワップ振替",
		"その他",
		"総合計",
	];
	let header=order.join(",");
	let data="";
	for(let i=0;i<records.length;++i){
		let record=records[i];
		for(let j=0;j<order.length;++j){
			let key=order[j];
			let val=record[key];
			data += (val!=null ? val:"")+(j+1==order.length ? "" :",");
		}
		data += "\n";
	}
	
	let str = Encoding.stringToCode(header+"\n"+data);
	let convert = Encoding.convert(str, 'sjis', 'unicode');
	let u8a = new Uint8Array(convert);

	let blob = new Blob([u8a],{type:"text/csv"});
	let link = document.createElement('a');
	link.href = URL.createObjectURL(blob);
	link.download = 'fx.csv';
	link.click();
}