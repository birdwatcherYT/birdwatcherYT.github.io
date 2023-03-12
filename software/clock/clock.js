function zeroPadding(num, length) {
	return num.toString().padStart(length, "0");
}

window.AudioContext = window.AudioContext || window.webkitAudioContext;

function play() {
	const ctx = new AudioContext();
	const oscillator = ctx.createOscillator();
	const loop = 5;
	const freqs = [700, 0];
	const times = [0.5, 0.1];
	let current_time = ctx.currentTime;
	for (let k = 0; k < loop; k++)
		for (let i = 0; i < freqs.length; i++) {
			oscillator.frequency.setValueAtTime(freqs[i], current_time);
			current_time += times[i];
		}
	oscillator.connect(ctx.destination);
	oscillator.start(ctx.currentTime);
	oscillator.stop(current_time);
}


let alerm_datetime = null;

function alerm_reset() {
	alerm_datetime = null;
	document.getElementById("alerm_button").textContent = "Set";
	document.getElementById("alerm_date").disabled = false;
}
function alerm_set() {
	let alerm_str = document.getElementById("alerm_date").value
	alerm_datetime = new Date(alerm_str);
	if (Number.isNaN(alerm_datetime.getTime())) {
		alert("日時を設定してください");
		alerm_datetime = null;
		return;
	}
	let date = new Date();
	if (date.getTime() >= alerm_datetime.getTime()) {
		alert("現在時刻より未来の時刻を設定してください");
		alerm_datetime = null;
		return;
	}
	document.getElementById("alerm_button").textContent = "Reset";
	document.getElementById("alerm_date").disabled = true;
}
function alerm_check() {
	if (alerm_datetime == null)
		return;
	let date = new Date();
	if (date.getTime() >= alerm_datetime.getTime()) {
		play();
		// alert(alerm_datetime.toLocaleString());
		alerm_reset();
	}
}
function alerm_click() {
	if (alerm_datetime == null) {
		alerm_set();
	} else {
		alerm_reset();
	}
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
function clock() {
	const date = new Date();
	const year = zeroPadding(date.getFullYear(), 4);
	const month = zeroPadding(date.getMonth() + 1, 2);
	const day = zeroPadding(date.getDate(), 2);
	const weekday = WEEKDAYS[date.getDay()];
	const hour = zeroPadding(date.getHours(), 2);
	const minute = zeroPadding(date.getMinutes(), 2);
	const second = zeroPadding(date.getSeconds(), 2);
	document.getElementById("date").innerHTML = year + "/" + month + "/" + day + " " + weekday;
	document.getElementById("time").innerHTML = hour + ":" + minute + ":" + second;
}

clock();
setTimeout(() => {
	clock();
	try {
		// バックグラウンド対応
		const code = `
			onmessage = (e) => {
				setInterval(() => self.postMessage(null), e.data);
			};
		`;
		const worker = new Worker("data:text/javascript;base64," + btoa(code));
		worker.onmessage = (e) => {
			clock(); alerm_check();
		};
		worker.postMessage(1000);
	} catch (_) {
		// Workerが使えないとき
		console.log("cannot use worker");
		const id = setInterval(() => { clock(); alerm_check(); }, 1000);
	}
}, 1000 - new Date().getMilliseconds());

