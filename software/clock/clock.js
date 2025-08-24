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

let startTime = null;
let setTime = null;
let timerWorker = null;
function timer_reset() {
	timerWorker?.terminate();
	startTime = null;
	document.getElementById("timer_button").textContent = "Set";
	document.getElementById("minute_selector").disabled = false;
	document.getElementById("second_selector").disabled = false;
	document.getElementById("timer").innerHTML = "";
}
function timer() {
	if (startTime == null) return;
	const elapsed = Math.floor((performance.now() - startTime) / 1000);
	let rest = setTime - elapsed;
	if (rest <= 0) {
		play();
		rest = 0;
		timer_reset();
	}
	const second = rest % 60;
	const minute = (rest - second) / 60;
	document.getElementById("timer").innerHTML = minute + ":" + zeroPadding(second, 2);
}
function timer_set() {
	const minute = Number(document.getElementById("minute_selector").value);
	const second = Number(document.getElementById("second_selector").value);
	setTime = minute * 60 + second;
	if (setTime <= 0) {
		alert("1秒以上を指定してください");
		setTime = null;
		return;
	}
	startTime = performance.now();
	document.getElementById("timer_button").textContent = "Reset";
	document.getElementById("minute_selector").disabled = true;
	document.getElementById("second_selector").disabled = true;

	const code = `
	onmessage = (e) => {
		setInterval(() => self.postMessage(null), e.data);
	};`;
	timerWorker = new Worker("data:text/javascript;base64," + btoa(code));
	timerWorker.onmessage = (e) => { timer(); };
	timerWorker.postMessage(200);
	timer();
}

function timer_click() {
	if (startTime == null) {
		timer_set();
	} else {
		timer_reset();
	}
}

// --- PIP機能 ここから ---
const pipButton = document.getElementById("pip-button");
const timerPipButton = document.getElementById("timer-pip-button");
const videoElement = document.createElement('video');
videoElement.autoplay = true;

let pipCanvasWorker = null;
let activePipMode = null; // 'clock' or 'timer'

function updatePipButtonsState() {
	if (activePipMode === 'clock') {
		pipButton.textContent = 'Exit PiP mode';
		timerPipButton.textContent = 'Picture in Picture';
	} else if (activePipMode === 'timer') {
		pipButton.textContent = 'Picture in Picture';
		timerPipButton.textContent = 'Exit PiP mode';
	} else {
		pipButton.textContent = 'Picture in Picture';
		timerPipButton.textContent = 'Picture in Picture';
	}
}

async function pip_click(mode) {
	try {
		if (document.pictureInPictureElement) {
			if (activePipMode === mode) {
				await document.exitPictureInPicture();
			} else {
				pipCanvasWorker?.terminate();
				activePipMode = mode;
				updatePipButtonsState();
				await startPipRender(mode, false);
			}
		} else {
			activePipMode = mode;
			await startPipRender(mode, true);
		}
	} catch (error) {
		console.error("PiP mode failed: ", error);
		alert('Failed to enter/exit PiP mode.');
		activePipMode = null;
		updatePipButtonsState();
	}
}

async function startPipRender(mode, requestNewWindow = false) {
	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');
	let renderCanvas;

	const getTextWidth = (text, font) => {
		const context = document.createElement('canvas').getContext('2d');
		context.font = font;
		return context.measureText(text).width;
	};

	if (mode === 'clock') {
		const dateElement = document.getElementById("date");
		const timeElement = document.getElementById("time");
		
		const dateFontSize = 36;
		const timeFontSize = 96;
		const dateFont = `${dateFontSize}px monospace, serif`;
		const timeFont = `bold ${timeFontSize}px monospace, serif`;

		const dateWidth = getTextWidth(dateElement.textContent, dateFont);
		const timeWidth = getTextWidth(timeElement.textContent, timeFont);
		
		const horizontalPadding = 40;
		const verticalPadding = 20;
		const lineSpacing = 10;
		
		canvas.width = Math.max(dateWidth, timeWidth) + horizontalPadding;
		canvas.height = dateFontSize + timeFontSize + lineSpacing + verticalPadding * 2;
		
		const dateY = verticalPadding + dateFontSize / 2;
		const timeY = verticalPadding + dateFontSize + lineSpacing + timeFontSize / 2;

		renderCanvas = () => {
			const bodyStyle = window.getComputedStyle(document.body);
			ctx.fillStyle = bodyStyle.backgroundColor;
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			ctx.fillStyle = bodyStyle.color;
			ctx.font = dateFont;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText(dateElement.textContent, canvas.width / 2, dateY);
			ctx.font = timeFont;
			ctx.fillText(timeElement.textContent, canvas.width / 2, timeY);
		};
	} else if (mode === 'timer') {
		const timerElement = document.getElementById("timer");
		const timerFontSize = 96;
		const timerFont = `bold ${timerFontSize}px monospace, serif`;
		const timerText = timerElement.innerHTML || "0:00";
		
		const timerWidth = getTextWidth(timerText, timerFont);
		
		const horizontalPadding = 40;
		const verticalPadding = 10;

		canvas.width = timerWidth + horizontalPadding;
		canvas.height = timerFontSize + verticalPadding * 2;

		renderCanvas = () => {
			const bodyStyle = window.getComputedStyle(document.body);
			ctx.fillStyle = bodyStyle.backgroundColor;
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			ctx.fillStyle = bodyStyle.color;
			ctx.font = timerFont;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			const currentTimerText = timerElement.innerHTML || "0:00";
			ctx.fillText(currentTimerText, canvas.width / 2, canvas.height / 2);
		};
	}

	renderCanvas();

	const code = `onmessage = (e) => { setInterval(() => self.postMessage(null), e.data); };`;
	pipCanvasWorker = new Worker("data:text/javascript;base64," + btoa(code));
	pipCanvasWorker.onmessage = () => { renderCanvas(); };
	pipCanvasWorker.postMessage(200);

	videoElement.srcObject = canvas.captureStream();
	await videoElement.play();

	if (requestNewWindow) {
		await videoElement.requestPictureInPicture();
	}
}

function initializePip() {
	if (!document.pictureInPictureEnabled) {
		pipButton.disabled = true;
		timerPipButton.disabled = true;
		pipButton.textContent = 'PiP not supported';
		timerPipButton.textContent = 'PiP not supported';
		return;
	}

	videoElement.addEventListener('enterpictureinpicture', () => {
		updatePipButtonsState();
	});

	videoElement.addEventListener('leavepictureinpicture', () => {
		pipCanvasWorker?.terminate();
		pipCanvasWorker = null;
		activePipMode = null;
		updatePipButtonsState();
	});
}
// --- PIP機能 ここまで ---

clock();
setTimeout(() => {
	clock();
	initializePip(); // PIP機能の初期化
	try {
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
		console.log("cannot use worker");
		setInterval(() => { clock(); alerm_check(); }, 1000);
	}
}, 1000 - new Date().getMilliseconds());
