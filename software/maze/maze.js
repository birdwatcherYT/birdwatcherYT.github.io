function get1d(n){
	return [...Array(n)].map(() => 0);
}

function get2d(m,n){
	return [...Array(m)].map(() => get1d(n));
}

function getRandInt(n) {
	return Math.floor(Math.random() * n);
}

function print_maze(maze, start, goal){
	const row=maze.length;
	const col=maze[0].length;

	str="<table>";
	for (let i = 0; i <row; i++){
		str+="<tr>";
		for (let j = 0; j <col; j++){
			c = " ";
			if (start[0]==i && start[1]==j){
				c="S";
			}else if (goal[0]==i && goal[1]==j){
				c="G";
			}
			str+="<td bgcolor=" + (maze[i][j]=="W" ? '"#000000"':'"#eeeeee"') +">" + c + "</td>";
		}
		str+="</tr>";
	}
	str+="</table>";
	return str;
}

// 道延ばし法(穴彫り法)によるランダム迷路形成
//row, colは奇数
function buildFromDigMethod(row, col) {
	const COUNT_MAX = 100000;
	const UP = 0, DOWN = 1, LEFT = 2, RIGHT = 3;
	const start = [2, 2];
	const goal = [row - 3, col - 3];
	
	let maze= get2d(row,col);
	//すべて壁にする
	for (let i = 0; i < row; i++) {
		for (let j = 0; j < col; j++) {
			maze[i][j] = "W";
		}
	}
	//外周を道で囲む
	for (let i = 0; i < col; i++) {
		maze[0][i] = "F";
		maze[row - 1][i] = "F";
	}
	for (let i = 0; i < row; i++) {
		maze[i][0] = "F";
		maze[i][col - 1] = "F";
	}
	let i = 2, j = 2, count = 0;
	maze[i][j] = "F";
	let right, left, up, down;
	while (!end(maze) && count < COUNT_MAX) {
		right = left = up = down = true;
		count++;
		while (right || left || up || down) {
			let dir = getRandInt(4);
			switch (dir) {
				case UP:
					if (maze[i - 2][j]=="W") {
						i--;
						maze[i][j] = "F";
						i--;
						maze[i][j] = "F";
					} else {
						up = false;
					}
					break;
				case DOWN:
					if (maze[i + 2][j]=="W") {
						i++;
						maze[i][j] = "F";
						i++;
						maze[i][j] = "F";
					} else {
						down = false;
					}
					break;
				case LEFT:
					if (maze[i][j - 2]=="W") {
						j--;
						maze[i][j] = "F";
						j--;
						maze[i][j] = "F";
					} else {
						left = false;
					}
					break;
				case RIGHT:
					if (maze[i][j + 2]=="W") {
						j++;
						maze[i][j] = "F";
						j++;
						maze[i][j] = "F";
					} else {
						right = false;
					}
					break;
			}
		}
		i = getRandInt(Math.floor(row / 2 - 2)) * 2 + 2;
		j = getRandInt(Math.floor(col / 2 - 2)) * 2 + 2;
		while (maze[i][j] == "W") {
			i = getRandInt(Math.floor(row / 2 - 2)) * 2 + 2;
			j = getRandInt(Math.floor(col / 2 - 2)) * 2 + 2;
		}
	}
	if (count == COUNT_MAX) {
		maze[row - 3][col - 3] = "F";
		if (getRandInt(2) == UP) {
			maze[row - 4][col - 3] = "F";
		} else {
			maze[row - 3][col - 4] = "F";
		}
	}
	return [maze, start, goal];
}

function end(maze) {
	const row=maze.length;
	const col=maze[0].length;
	for (let i = 2; i < row; i += 2) {
		for (let j = 2; j < col; j += 2) {
			if (maze[i][j]=="W") {
				return false;
			}
		}
	}
	return true;
}

//棒倒し法によるランダム迷路の形成。
//row, colは奇数
function buildFromBarFallMethod(row, col, multi) {
	const start = [1,1];
	const goal = [row - 2, col - 2];
	const UP = 0, DOWN = 1, LEFT = 2, RIGHT = 3;

	let maze = get2d(row, col);
	for (let i = 0; i < row; i++) {
		for (let j = 0; j < col; j++) {
			maze[i][j] = "F";
		}
	}
	//外壁
	for (let i = 0; i < col; i++) {
		maze[0][i] = "W";
		maze[row - 1][i] = "W";
	}
	for (let i = 0; i < row; i++) {
		maze[i][0] = "W";
		maze[i][col - 1] = "W";
	}
	// 内壁を1つおきに作る
	for (let i = 0; i < row; i += 2) {
		for (let j = 0; j < col; j += 2) {
			maze[i][j] = "W";
		}
	}
	
	if (multi){
		//内壁からランダムに各方向に壁を作る
		for (let i = 2; i < row - 1; i += 2) {
			for (let j = 2; j < col - 1; j += 2) {
				switch (getRandInt(4)) {
					case UP:
						maze[i - 1][j] = "W";
						break;
					case DOWN:
						maze[i + 1][j] = "W";
						break;
					case LEFT:
						maze[i][j - 1] = "W";
						break;
					case RIGHT:
						maze[i][j + 1] = "W";
						break;
				}
			}
		}
	}else{
		//一番上の内壁のみから、棒を倒す
		for (let j = 2; j < col - 1; j += 2) {
			let i = 2;
			let flag = true;
			while (flag) {
				let dir = getRandInt(4);
				switch (dir) {
					case UP:
						if (maze[i - 1][j]!="W") {
							maze[i - 1][j] = "W";
							flag = false;
						}
						break;
					case DOWN:
						if (maze[i + 1][j]!="W") {
							maze[i + 1][j] = "W";
							flag = false;
						}
						break;
					case LEFT:
						if (maze[i][j - 1]!="W") {
							maze[i][j - 1] = "W";
							flag = false;
						}
						break;
					case RIGHT:
						if (maze[i][j + 1]!="W") {
							maze[i][j + 1] = "W";
							flag = false;
						}
						break;
				}
			}
		}
		//内壁から各方向に壁を作る
		for (let i = 4; i < row - 1; i += 2) {
			for (let j = 2; j < col - 1; j += 2) {
				let flag = true;
				while (flag) {
					//UP以外で倒す
					let dir = getRandInt(3) + 1;
					switch (dir) {
						case DOWN:
							if (maze[i + 1][j]!="W") {
								maze[i + 1][j] = "W";
								flag = false;
							}
							break;
						case LEFT:
							if (maze[i][j - 1]!="W") {
								maze[i][j - 1] = "W";
								flag = false;
							}
							break;
						case RIGHT:
							if (maze[i][j + 1]!="W") {
								maze[i][j + 1] = "W";
								flag = false;
							}
							break;
					}
				}
			}
		}
	}

	return [maze, start, goal];
}
