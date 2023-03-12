importScripts("priorityQueue.js", "zobristHashing.js", "helper.js");

function solve(board) {
	const size = board.length;
	const nums = size * size;
	// Zobrist hashing
	const hash = new ZobristHashing(nums * nums);
	const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];

	// ヒューリスティック関数 h
	const heuristic = (data) => {
		let dist = 0;
		for (let i = 0; i < size; ++i) {
			for (let j = 0; j < size; ++j) {
				const a = (data[i][j] - 1 + nums) % nums;
				const x = Math.floor(a / size), y = a % size;
				dist += Math.abs(x - i) + Math.abs(y - j);
			}
		}
		return dist;
	};

	// f=g+h
	const fValue = new Map();
	const goalHash = hash.hashData(goalBoard(board.length));

	// f, state
	const pq = new PriorityQueue();
	fValue.set(hash.hashData(board), { fValue: heuristic(board), parent: undefined, data: board });
	pq.push(heuristic(board), board);

	let loop = 0;
	while (pq.size()) {
		const { key: nowF, value: array } = pq.pop();
		const nowHash = hash.hashData(array);
		// ゴール
		if (nowHash === goalHash)
			break;
		loop++;
		if (loop % 10000 === 0) {
			postMessage({ status: "doing", progress: `visit: ${loop} < queue: ${pq.size()}` });
			console.log(loop);
		}
		let node = fValue.get(nowHash);
		if (node !== undefined && node.fValue < nowF)
			continue;
		// 現在の真のコスト
		const nowG = nowF - heuristic(array);
		const [nowRow, nowCol] = zeroPosition(array);
		// 次のノードへ
		for (const [di, dj] of directions) {
			const nextRow = nowRow + di, nextCol = nowCol + dj;
			if (0 > nextRow || nextRow >= size || 0 > nextCol || nextCol >= size)
				continue;
			const nextArray = array.map(x => x.concat());
			[nextArray[nowRow][nowCol], nextArray[nextRow][nextCol]] = [nextArray[nextRow][nextCol], nextArray[nowRow][nowCol]];
			const nextCost = nowG + 1 + heuristic(nextArray);
			const nextHash = hash.hashData(nextArray);
			const nextNode = fValue.get(nextHash);
			if (nextNode === undefined || nextCost < nextNode.fValue) {
				fValue.set(nextHash, { fValue: nextCost, parent: nowHash, data: nextArray });
				pq.push(nextCost, nextArray);
			}
		}
	}
	console.log("goal");
	postMessage({ status: "doing", progress: `visit: ${loop} < queue: ${pq.size()}` });

	const path = [];
	let node = fValue.get(goalHash);
	while (node !== undefined) {
		path.push(node.data);
		if (node.parent === undefined) break;
		node = fValue.get(node.parent);
	}
	console.log("path");
	path.reverse();
	return path;
}
console.log("worker started");
onmessage = (e) => {
	// console.log("worker received message", e.data);
	const path = solve(e.data);
	postMessage({ status: "done", path: path });
};
