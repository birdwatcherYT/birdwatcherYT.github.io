const Status = {
	Manual: "Manual",
	Solving: "Solving",
	Solved: "Solved",
	Playing: "Playing",
	Clear: "Clear"
};


// ミリ秒間待機する
function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}


function slidable(board, p) {
	if (board[p.i][p.j] === 0)
		return true;
	if (p.i + 1 < board.length && board[p.i + 1][p.j] === 0)
		return true;
	if (p.i - 1 >= 0 && board[p.i - 1][p.j] === 0)
		return true;
	if (p.j + 1 < board.length && board[p.i][p.j + 1] === 0)
		return true;
	if (p.j - 1 >= 0 && board[p.i][p.j - 1] === 0)
		return true;

	return false;
}


const property = {
	stop: false,
	size: 3,
	speed: 500,
	board: randomBoard(3),
	dragPoint: { j: -1, i: -1 },
	answer: [],
	status: Status.Manual,
	message: "",
	progress: "",
	worker: null,
};

function MakeTable() {
	return (`
	${property.board.map((row, i) =>
		`<tr>${row.map((x, j) => `<td
					draggable="${slidable(property.board, { i: i, j: j })}"
					ondragstart="dragStart({ i: ${i}, j: ${j} });"
					ondragenter="dragEnter({ i: ${i}, j: ${j} })"
					onclick="clickSwap({ i: ${i}, j: ${j} })"
				>${x === 0 ? "" : x}</td>`).join("")
		}</tr>`).join("")}
	`);
}

const updatePanel = () => {
	document.getElementById("size").disabled = (property.status === Status.Solving || property.status === Status.Playing);
	document.getElementById("reset").disabled = (property.status === Status.Solving || property.status === Status.Playing);
	document.getElementById("solve").disabled = (property.status !== Status.Manual);
	document.getElementById("play").disabled = (property.answer.length === 0 || property.status === Status.Solving || property.status === Status.Playing);
	document.getElementById("stop").disabled = (property.status !== Status.Solving && property.status !== Status.Playing);

	document.getElementById("output").innerHTML = MakeTable();

	document.getElementById("status").innerHTML = `Status: ${property.status} ${property.status === Status.Solved ? property.message : ""}`;
	document.getElementById("progress").innerHTML = property.progress;
}

updatePanel();

const onClickReset = () => {
	property.board = randomBoard(property.size);
	property.answer = [];
	property.status = Status.Manual;
	property.progress = "";
	property.stop = false;
	updatePanel();
};
const onClickSolve = async () => {
	property.status = Status.Solving;
	updatePanel();
	property.worker = new Worker("worker.js");
	property.worker.onmessage = (e) => {
		// console.log("parent received message:", e.data);
		if (e.data.status === "done") {
			property.worker.terminate();
			const path = e.data.path;
			property.status = Status.Solved;
			property.message = `(${path.length - 1} step)`;
			console.log(path);
			property.answer = path;
			property.stop = false;
			updatePanel();
		} else {
			property.progress = e.data.progress;
			document.getElementById("progress").innerHTML = property.progress;
		}
	};
	property.worker.postMessage(property.board);
};
const onClickPlay = async () => {
	if (property.answer.length === 0)
		return;
	property.status = Status.Playing;
	for (const brd of property.answer) {
		property.board = brd;
		console.log(brd);
		updatePanel();
		await sleep(property.speed);
		if (property.stop) {
			property.stop = false;
			return;
		}
	}
	property.stop = false;
	property.status = Status.Clear;
	updatePanel();
};
const onClickStop = () => {
	property.stop = true;
	property.status = Status.Manual;
	property.worker?.terminate();
	updatePanel();
};
const onChangeSize = (select) => {
	property.size = Number(select.value);
	property.board = randomBoard(property.size);
	property.answer = [];
	property.status = Status.Manual;
	property.progress = "";
	property.stop = false;
	updatePanel();
};
const onChangeSpeed = (range) => {
	property.speed = -Number(range.value);
	updatePanel();
};

const dragStart = (p) => {
	console.log(p);
	property.dragPoint = p;
};
const dragEnter = (p) => {
	if (property.status === Status.Solving || property.status === Status.Playing)
		return;
	if (slidable(property.board, p) && slidable(property.board, property.dragPoint) && (property.board[p.i][p.j] === 0 || property.board[property.dragPoint.i][property.dragPoint.j] === 0)) {
		[property.board[property.dragPoint.i][property.dragPoint.j], property.board[p.i][p.j]] = [property.board[p.i][p.j], property.board[property.dragPoint.i][property.dragPoint.j]];
		property.dragPoint = p;
		property.status = (isGoal(property.board) ? Status.Clear : Status.Manual);
		property.stop = false;
		updatePanel();
	}
};
const clickSwap = (p) => {
	if (property.status === Status.Solving || property.status === Status.Playing)
		return;
	const [x, y] = zeroPosition(property.board);
	if (slidable(property.board, p) && property.board[p.i][p.j] !== 0) {
		[property.board[x][y], property.board[p.i][p.j]] = [property.board[p.i][p.j], property.board[x][y]];
		property.status = (isGoal(property.board) ? Status.Clear : Status.Manual);
		property.stop = false;
		updatePanel();
	}
};
