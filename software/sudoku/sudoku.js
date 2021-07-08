function get1d(n){
	return [...Array(n)].map(() => 0);
}

function get2d(n){
	return [...Array(n)].map(() => get1d(n));
}

function getRandInt(n) {
	return Math.floor(Math.random() * n);
}

function __fill_rows(board,m,n, i, try_num){
	//i行以降をランダムに埋める再帰関数 (埋まった状態の盤面作成用ヒューリスティック)
	if (i >= board.length){
		return true;
	}
	for (let k=0; k<try_num; k++){
		if (!__fill_vals(board,m,n, i, 0, try_num)){
			continue;
		}
		if (__fill_rows(board,m,n, i+1, try_num)){
			return true;
		}
	}
	return false;
}

function __fill_vals(board,m,n, i, j, try_num){
	//i行目のj列以降をランダムに埋める再帰関数 (埋まった状態の盤面作成用ヒューリスティック)
	if (j >= board.length){ //最後の列まで埋まったら
		return true;
	}
	for (let k=0; k<try_num; k++){
		board[i][j] = getRandInt(board.length)+1;
		if (check_duplicate(board,m,n, i, j)){
			continue; //重複したら別の数字をトライ
		}
		if (__fill_vals(board,m,n, i, j+1, try_num)) {//次の値を埋めに行く
			return true;
		}
	}
	board[i][j] = 0;
	return false;
}

function check_duplicate(board,m,n, i, j){
	//(i,j)が属する行、列、ブロックで、0以外の数字が重複してたらTrue
	//行
	let count=get1d(board.length);
	for (let k=0; k<board.length; k++){
		const val=board[i][k];
		if (val==0){
			continue;
		}
		if (count[val-1]==1){
			return true;
		}
		count[val-1]=1;
	}
	//列
	count=count.fill(0);
	for (let k=0; k<board.length; k++){
		const val=board[k][j];
		if (val==0){
			continue;
		}
		if (count[val-1]==1){
			return true;
		}
		count[val-1]=1;
	}
	//ブロック
	count=count.fill(0);
	const start_i = Math.floor(i/m) * m;
	const start_j = Math.floor(j/n) * n;
	for (let k1=0; k1<m; k1++){
		for (let k2=0; k2<n; k2++){
			const val=board[start_i+k1][start_j+k2];
			if (val==0){
				continue;
			}
			if (count[val-1]==1){
				return true;
			}
			count[val-1]=1;
		}
	}
	return false;
}

function create_problem(m, n, try_num, level){
	//問題作成 (埋まった状態から穴をあけていくバージョン)
	//最初に答えの盤面を作る必要がある. 
	//try_num: 答えの盤面作成で試行する回数. m*nくらいが良さそう. 
	//level: 穴あけ失敗許容回数

	const size=m*n;
	if (size==1){
		return [[0]];
	}
	// 空の盤面作成
	let board = get2d(size);
	// 盤面を全て埋める
	if (!__fill_rows(board, m, n, 0, try_num)){
		return [];
	}
	let cnt = 0 // 穴あけに失敗した回数
	while (true){
		let i, j;
		console.log(".")
		while (true){
			i = getRandInt(size);
			j = getRandInt(size);
			if (board[i][j]!=0){
				break;
			}
		}
		const tmp = board[i][j];
		// 盤面に穴をあける
		board[i][j] = 0;
		if (is_unique(board,m,n)==0){
			// 一意でなくなったら値をもとに戻す
			board[i][j] = tmp;
			cnt++;
			if (cnt >= level){
				break;
			}
		}
	}
	return board;
}

function* __solve(board,m,n, pos){
	//深さ優先探索で解を求める
	const i = Math.floor(pos / board.length);
	const j = pos % board.length;
	if (pos >= board.length*board.length){
		// すべて埋まったら
		yield board;
		return;
	}
	if (board[i][j] != 0){ //数字が埋まっていれば次のマスへ
		yield * __solve(board,m,n, pos+1);
		return;
	}
	//すべての数字を試す
	for (let k=0;k<board.length;k++){
		board[i][j] = k+1;
		if (check_duplicate(board,m,n, i, j)){
			continue; //重複したら次の数字をトライ
		}
		yield * __solve(board,m,n, pos+1);
	}
	board[i][j] = 0;
}

function solve(board,m,n){
	//深さ優先探索で解を求める
	let board_copy = JSON.parse(JSON.stringify(board))
	return __solve(board_copy,m,n, 0);
}

function is_unique(board,m,n){
	// 解が一意かどうか判定
	// 1: 一意
	// 0: 一意でない
	// -1: 解なし
	let cnt = 0
	for (let ans of solve(board,m,n)){
		cnt++;
		//一意でない
		if (cnt>=2){
			return 0;
		}
	}
	// 一意
	if (cnt==1){
		return 1;
	}
	// 解なし
	return -1;
}

function print_board(board, m, n){
	str="<table>"
	for (let i = 0; i <board.length ; i++){
		str+="<tr>";
		style_i = (i+1)%m==0 ? 'style="border-bottom: solid 3px;' : 'style="';
		if (i==0){
			style_i+="border-top: solid 3px;"
		}
		for (let j = 0; j <board.length; j++){
			style_j = j==0 ? "border-left: solid 3px;":""
			style_j += (j+1)%n==0 ? 'border-right: solid 3px;"' : '"';
			str+="<td "+style_i+style_j+">" + (board[i][j]!=0 ? board[i][j] : " ") + "</td>";
		}
		str+="</tr>";
	}
	str+="</table>"
	return str;
}
