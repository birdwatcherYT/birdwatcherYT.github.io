function isGoal(board) {
	const size = board.length;
	const nums = size * size;
	for (let i = 0; i < size; i++) {
		for (let j = 0; j < size; j++)
			if (board[i][j] !== (i * size + j + 1) % nums)
				return false;
	}
	return true;
}


function goalBoard(size) {
	const nums = size * size;
	const board = [];
	for (let i = 0; i < size; ++i) {
		const row = [];
		for (let j = 0; j < size; ++j)
			row.push((i * size + j + 1) % nums);
		board.push(row);
	}
	return board;
}


function randomBoard(size) {
	const board = goalBoard(size);
	const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];
	const loop = size ** 4;
	let i = size - 1, j = size - 1;
	for (let k = 0; k < loop; ++k) {
		const [di, dj] = directions[Math.floor(Math.random() * directions.length)];
		const x = i + di, y = j + dj;
		if (0 > x || x >= size || 0 > y || y >= size)
			continue;
		[board[i][j], board[x][y]] = [board[x][y], board[i][j]];
		i = x; j = y;
	}
	return board;
}

const zeroPosition = (board) => {
	for (let i = 0; i < board.length; ++i) {
		for (let j = 0; j < board.length; ++j) {
			if (board[i][j] === 0)
				return [i, j];
		}
	}
	return [-1, -1];
};
