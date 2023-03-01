class Node {
	constructor(value) {
		this.value = value;
		this.next = null;
	}
}

class Queue {
	// 連結リストで表現: head -> .... -> tail
	constructor() {
		this.head = null;
		this.tail = null;
		this.length = 0;
	}
	push(value) {
		// tailに追加
		const node = new Node(value);
		if (this.head) {
			this.tail.next = node;
			this.tail = node;
		} else {
			this.head = this.tail = node;
		}
		this.length++;
	}
	pop() {
		if (this.head) {
			const value = this.head.value;
			this.head = this.head.next;
			this.length--;
			return value;
		}
	}
	size() { return this.length; }
	empty() { return this.length == 0; }
	front() { return this.head?.value; }
}

function getRandInt(n) {
	return Math.floor(Math.random() * n);
}
function get1d(n) {
	return [...Array(n)].map(() => 0);
}

function get2d(m, n) {
	return [...Array(m)].map(() => get1d(n));
}

// ミリ秒間待機する
function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

const MultiplyDeBruijnBitPosition = [
	0, 1, 28, 2, 29, 14, 24, 3, 30, 22, 20, 15, 25, 17, 4, 8,
	31, 27, 13, 23, 21, 19, 16, 7, 26, 12, 18, 6, 11, 5, 10, 9
];
const COEFF = 0x077CB531 >>> 0;
function lsb_pos(x) {
	if (x == 0) return -1;
	// 最下位ビットだけを残す
	x = x & -x;
	x = x >>> 0;
	return MultiplyDeBruijnBitPosition[(x * COEFF) >>> 27];
}
function msb_pos(x) {
	if (x == 0) return -1;
	// 最上位ビットだけを残す
	x |= (x >>> 1);
	x |= (x >>> 2);
	x |= (x >>> 4);
	x |= (x >>> 8);
	x |= (x >>> 16);
	x = x ^ (x >>> 1);
	return MultiplyDeBruijnBitPosition[(x * COEFF) >>> 27];
}

function find_upper_pos(x, i) {
	// i bit目から上位ビット方向で最初に見つかる1の位置
	const mask = (-(1 << i)) | (1 << i);
	return lsb_pos(x & mask);
}

function find_lower_pos(x, i) {
	// i bit目から下位ビット方向で最初に見つかる1の位置
	const mask = ((1 << i) - 1) | (1 << i);
	return msb_pos(x & mask);
}


const N = 16;
const N2 = N * N;
const ROBOT_NUM = 4;
const ROBOT_COLORS = ["red", "green", "blue", "yellow"];

function ij2int(i, j) {
	return i + j * N;
}

function point2int(point) {
	let [i, j] = point;
	return i + j * N;
}

function int2point(id) {
	let i = id % N;
	let j = (id - i) / N;
	return [i, j];
}

function state2int(state) {
	let id = 0;
	let scale = 1;
	state.forEach(
		p => {
			id += p * scale;
			scale *= N2;
		}
	);
	return id;
}

function int2state(id) {
	let state = [];
	let scale = N2 ** (ROBOT_NUM - 1);
	for (let k = 0; k < ROBOT_NUM; ++k) {
		const ij = (id - id % scale) / scale;
		id %= scale;
		state.push(ij);
		scale /= N2;
	}
	return state.reverse();
}

function state2int_ignore_target(state, target) {
	let s_without_t = state.concat();
	[s_without_t[target], s_without_t[s_without_t.length - 1]] = [s_without_t[s_without_t.length - 1], s_without_t[target]];
	s_without_t.pop();
	s_without_t.sort();
	let id = 0;
	let scale = 1;
	s_without_t.forEach(
		p => {
			id += p * scale;
			scale *= N2;
		}
	);
	return id;
}

const IGNORE_TILES = [ij2int(N / 2 - 1, N / 2 - 1), ij2int(N / 2 - 1, N / 2), ij2int(N / 2, N / 2 - 1), ij2int(N / 2, N / 2)];


function random_positions(num) {
	let points = [];
	while (points.length < num) {
		let i = getRandInt(N2);
		if (IGNORE_TILES.includes(i))
			continue;
		if (!points.includes(i))
			points.push(i);
	}
	return points;
}


function get_fixed_wall() {
	// 周りを囲む
	let row_walls = new Array(N).fill(1 | (1 << N));
	let col_walls = new Array(N).fill(1 | (1 << N));
	// 使わないタイル周りを囲う
	IGNORE_TILES.forEach(p => {
		const [x, y] = int2point(p);
		row_walls[x] |= 1 << y;
		row_walls[x] |= 1 << (y + 1);
		col_walls[y] |= 1 << x;
		col_walls[y] |= 1 << (x + 1);
	});
	return [row_walls, col_walls];
}


function get_random_wall(num) {
	let row_walls = get1d(N);
	let col_walls = get1d(N);
	// ランダムに壁をつくる
	let points = random_positions(num);
	points.forEach(p => {
		const [x, y] = int2point(p);
		row_walls[x] |= getRandInt(2) ? (1 << y) : (1 << (y + 1));
		col_walls[y] |= getRandInt(2) ? (1 << x) : (1 << (x + 1));
	});
	return [row_walls, col_walls];
}


async function solve(row_walls, col_walls, init_state, target_index, goal_id) {
	if (!check_connect(row_walls, col_walls, init_state[target_index], goal_id))
		return [];
	let progress = document.getElementById("progress");

	let visit = new Array(N2);
	for (let i = 0; i < visit.length; ++i)
		visit[i] = new Set();
	let parent = {};
	let que = new Queue();
	let last_id = -1;

	let init_id = state2int(init_state);
	que.push(init_id);
	parent[init_id] = -1;
	visit[init_state[target_index]].add(state2int_ignore_target(init_state, target_index));
	let step = 0;
	while (!que.empty()) {
		const id = que.pop();
		let state = int2state(id);
		step++;
		if (step % 10000 == 0) {
			const msg = "visit: " + step + " << queue: " + que.size();
			// console.log(msg);
			progress.innerHTML = msg;
			await sleep(0);
			if (canceled) return [];
		}
		if (state[target_index] == goal_id) {
			last_id = id;
			console.log("solved!");
			const msg = "visit: " + step + " << queue: " + que.size();
			progress.innerHTML = msg;
			break;
		}
		const points = state.map(x => int2point(x));
		for (let k = 0; k < ROBOT_NUM; ++k) {
			const [i, j] = points[k];
			let row_wall = row_walls[i], col_wall = col_walls[j];
			for (let l = 0; l < ROBOT_NUM; ++l) if (l != k) {
				const [x, y] = points[l];
				if (x == i) {
					row_wall |= 1 << y;
					row_wall |= 1 << (y + 1);
				}
				if (y == j) {
					col_wall |= 1 << x;
					col_wall |= 1 << (x + 1);
				}
			}
			for (let d = 0; d < 4; ++d) {
				let new_i = i, new_j = j;
				// 壁にぶつかるまで進む
				switch (d) {
					case 0:// 上
						new_i = find_lower_pos(col_wall, i);
						if (new_i == i) continue;
						break;
					case 1:// 左
						new_j = find_lower_pos(row_wall, j);
						if (new_j == j) continue;
						break;
					case 2:// 下
						new_i = find_upper_pos(col_wall, i + 1) - 1;
						if (new_i == i) continue;
						break;
					case 3:// 右
						new_j = find_upper_pos(row_wall, j + 1) - 1;
						if (new_j == j) continue;
						break;
				}
				const org = state[k];
				state[k] = ij2int(new_i, new_j);
				const visit_id = state2int_ignore_target(state, target_index);
				if (!visit[state[target_index]].has(visit_id)) {
					visit[state[target_index]].add(visit_id);
					const next_id = state2int(state);
					que.push(next_id);
					parent[next_id] = id;
				}
				state[k] = org;
			}
		}
	}
	let path = [];
	let id = last_id;
	console.log(last_id)
	while (id >= 0) {
		path.push(int2state(id));
		id = parent[id];
	}
	path = path.reverse();
	return path;
}


function click_cell(cell) {
	if (document.getElementById("solve").disabled)
		return;
	console.log(cell.id);
	console.log(cell.style.backgroundColor);
	const [i, j] = cell.id.split(",").map(x => Number(x));
	const I = Math.floor(i / 2), J = Math.floor(j / 2);
	if (i % 2 == 1 && j % 2 == 1) {
		// 通常マス
		const id = ij2int(I, J);
		if (IGNORE_TILES.includes(id))
			return;
		if (init_state.includes(id))
			return;
		const index = document.getElementById("selected_robot").value;
		if (index < 0)
			goal_id = id;
		else
			init_state[index] = id;
	} else if (i % 2 == 0 && j % 2 == 1) {
		if (fixed_col_walls[J] & (1 << I))
			return;
		editable_col_walls[J] ^= (1 << I);
	} else if (i % 2 == 1 && j % 2 == 0) {
		if (fixed_row_walls[I] & (1 << J))
			return;
		editable_row_walls[I] ^= (1 << J);
	} else {
		return;
	}
	print_board(init_state);
}

function print_board(state) {
	const fontcolor = ROBOT_COLORS[target_index];
	let str = "<table>";
	for (let i = 0; i < 2 * N + 1; i++) {
		const I = Math.floor(i / 2);
		str += "<tr>";
		for (let j = 0; j < 2 * N + 1; j++) {
			const J = Math.floor(j / 2);
			let size = 1;
			let ch = "　";
			let color = "white";
			if (i % 2 == 1 && j % 2 == 1) {
				// 通常マス
				size = 30;
				color = "seashell";
				const id = ij2int(I, J);
				if (id == goal_id)
					ch = "★";
				let index = state.indexOf(id);
				if (index >= 0)
					color = ROBOT_COLORS[index];
				if (IGNORE_TILES.includes(id))
					color = "black";
			} else if (i % 2 == 0 && j % 2 == 1) {
				// 横方向の罫線
				if (fixed_col_walls[J] & (1 << I))
					color = "black";
				else if (editable_col_walls[J] & (1 << I))
					color = "gray";
			} else if (i % 2 == 1 && j % 2 == 0) {
				// 縦方向の罫線
				if (fixed_row_walls[I] & (1 << J))
					color = "black";
				else if (editable_row_walls[I] & (1 << J))
					color = "gray";
			} else {
				// 使わない点
				color = "black";
			}
			str += '<td id="' + i + "," + j + '" style="background-color:' + color + '" onclick="click_cell(this);">';
			str += '<font size="' + size + 'pt" color="' + fontcolor + '">' + ch + "</font>";
			str += "</td>";
		}
		str += "</tr>";
	}
	str += "</table>";

	document.getElementById("output").innerHTML = str;
}

function change_target() {
	target_index = document.getElementById("target_color").selectedIndex;
	print_board(init_state);
}

function add_wall_around_point(row_walls, col_walls, p) {
	const [x, y] = int2point(p);
	const row_wall = row_walls[x] | fixed_row_walls[x], col_wall = col_walls[y] | fixed_col_walls[y];
	if (!(col_wall & (1 << x)) && !(col_wall & (1 << (x + 1))))
		col_walls[y] |= getRandInt(2) ? (1 << x) : (1 << (x + 1));
	if (!(row_wall & (1 << y)) && !(row_wall & (1 << (y + 1))))
		row_walls[x] |= getRandInt(2) ? (1 << y) : (1 << (y + 1));
}

function dfs(row_walls, col_walls, i, j, seen) {
	if (i < 0 || j < 0 || i >= N || j >= N || seen[i][j])
		return;
	seen[i][j] = true;
	if (!(col_walls[j] & (1 << i)))
		dfs(row_walls, col_walls, i - 1, j, seen);
	if (!(col_walls[j] & (1 << (i + 1))))
		dfs(row_walls, col_walls, i + 1, j, seen);
	if (!(row_walls[i] & (1 << j)))
		dfs(row_walls, col_walls, i, j - 1, seen);
	if (!(row_walls[i] & (1 << (j + 1))))
		dfs(row_walls, col_walls, i, j + 1, seen);
}

function check_connectivity(row_walls, col_walls) {
	let seen = get2d(N, N);
	IGNORE_TILES.forEach(
		p => {
			const [x, y] = int2point(p);
			seen[x][y] = true;
		}
	);
	dfs(row_walls, col_walls, 0, 0, seen);
	// console.log(seen);
	for (let i = 0; i < N; ++i)
		for (let j = 0; j < N; ++j)
			if (!seen[i][j])
				return false;
	return true;
}

function check_connect(row_walls, col_walls, p1, p2) {
	const [p1i, p1j] = int2point(p1);
	const [p2i, p2j] = int2point(p2);
	let seen = get2d(N, N);
	dfs(row_walls, col_walls, p1i, p1j, seen);
	return seen[p2i][p2j];
}

function merge_wall(row_walls1, col_walls1, row_walls2, col_walls2) {
	let row_walls = get1d(N), col_walls = get1d(N);
	for (let i = 0; i < N; ++i) {
		row_walls[i] = row_walls1[i] | row_walls2[i];
		col_walls[i] = col_walls1[i] | col_walls2[i];
	}
	return [row_walls, col_walls];
}

function reset() {
	[fixed_row_walls, fixed_col_walls] = get_fixed_wall();
	for (let k = 0; k < 10000; ++k) {//リトライ回数
		[editable_row_walls, editable_col_walls] = get_random_wall(N + ROBOT_NUM);
		const [row_walls, col_walls] = merge_wall(fixed_row_walls, fixed_col_walls, editable_row_walls, editable_col_walls);
		if (check_connectivity(row_walls, col_walls))
			break;
	}
	target_index = 0;
	init_state = random_positions(ROBOT_NUM + 1);
	goal_id = init_state.pop();
	add_wall_around_point(editable_row_walls, editable_col_walls, goal_id);
	change_target();
	path = [];
	canceled = false;
	document.getElementById("answer").innerHTML = "　";
	document.getElementById("progress").innerHTML = "　";
	document.getElementById("play").disabled = true;
	document.getElementById("stop").disabled = true;
	//
	console.log(init_state);
	console.log(goal_id);
}


let fixed_row_walls, fixed_col_walls, editable_row_walls, editable_col_walls, target_index, init_state, goal_id, path, canceled;
reset();

function begin() {
	document.getElementById("target_color").disabled = true;
	document.getElementById("solve").disabled = true;
	document.getElementById("play").disabled = true;
	document.getElementById("shuffle").disabled = true;
	document.getElementById("stop").disabled = false;
	canceled = false;
}
function end() {
	canceled = false;
	document.getElementById("target_color").disabled = false;
	document.getElementById("solve").disabled = false;
	document.getElementById("play").disabled = false;
	document.getElementById("shuffle").disabled = false;
	document.getElementById("stop").disabled = true;
}

async function click_solve() {
	begin();
	document.getElementById("answer").innerHTML = "solving";
	const [row_walls, col_walls] = merge_wall(fixed_row_walls, fixed_col_walls, editable_row_walls, editable_col_walls);
	const startTime = performance.now();
	path = await solve(row_walls, col_walls, init_state, target_index, goal_id);
	const endTime = performance.now();
	console.log(path);
	document.getElementById("answer").innerHTML = (path.length ? ("solved: " + (path.length - 1) + "step") : (canceled ? "canceled" : "infeasible"))
		+ " [" + Math.round((endTime - startTime) / 1000) + "s]";
	end();
}
async function click_play() {
	begin();
	for (let i = 0; i < path.length; ++i) {
		console.log(path[i]);
		print_board(path[i]);
		await sleep(1000);
		if (canceled) {
			print_board(init_state);
			break;
		}
	}
	end();
}
function click_shuffle() {
	reset();
}

function click_stop() {
	canceled = true;
}
// 最適化中はクリックされないようにする
