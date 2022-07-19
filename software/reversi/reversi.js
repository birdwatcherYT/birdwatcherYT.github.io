function get1d(n){
	return [...Array(n)].map(() => 0);
}

function get2d(m,n){
	return [...Array(m)].map(() => get1d(n));
}

// ミリ秒間待機する
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function update(){
	let str=reversi.print_board();
	let output=document.getElementById("output");
	output.innerHTML=str;
}

async function onclickTd(obj){
	// クリックしたときの動作
	let pos=obj.id;
	let ij=pos.split(",");
	let i=Number(ij[0]), j=Number(ij[1]);
	if (reversi.setable(i, j)) {
		let undo = new Undo(i, j);
		reversi.putOn(i, j);
		reversi.reverse(undo);
		reversi.counter = reversi.getCount();
		reversi.updateStatus();
		reversi.nextTurn();
		update();
		await sleep(1000);
		if (reversi.gameStatus == reversi.PLAY) {
			if (!reversi.canPut()) {//相手がパスなら
				alert("コンピュータはパスです");
				reversi.nextTurn();
				if (!reversi.canPut()) {
					reversi.passPass = true;
					reversi.updateStatus();
				}
				update();
			} else {
				reversi.computer();
			}
		}
	}
}


class Reversi {
	constructor() {
		// マスの状態
		this.BLANK=0;
		this.BLACK=1;
		this.WHITE=-1;
		// status
		this.PLAY=0;
		this.BLACK_WIN = 1;
		this.WHITE_WIN = 2;
		this.DRAW = 3;
		//
		this.placeValue=[
			[120, -20, 20, 5, 5, 20, -20, 120],
			[-20, -40, -5, -5, -5, -5, -40, -20],
			[20, -5, 15, 3, 3, 15, -5, 20],
			[5, -5, 3, 3, 3, 3, -5, 5],
			[5, -5, 3, 3, 3, 3, -5, 5],
			[20, -5, 15, 3, 3, 15, -5, 20],
			[-20, -40, -5, -5, -5, -5, -40, -20],
			[120, -20, 20, 5, 5, 20, -20, 120]
		];
		// 表示用
		this.BLANK_DISP="　";
		this.BLACK_DISP='<font color="black">●</font>';
		this.WHITE_DISP='<font color="white">●</font>';
	}
	
	initialize(n, serchLevel, userFirst){
		this.serchLevel=serchLevel;
		this.n = n;
		this.userFirst=userFirst;//ユーザーが先攻かどうか
		//
		this.blackFlag=true; // 現在のターン
		this.passPass = false; // 両方パスかどうか
		this.gameStatus = this.PLAY; // ゲームの状態
		//
		this.board = get2d(this.n,this.n);
		let center = this.n/2;
		this.board[center][center]=this.WHITE;
		this.board[center-1][center-1]=this.WHITE;
		this.board[center-1][center]=this.BLACK;
		this.board[center][center-1]=this.BLACK;
		this.counter=this.getCount();
		//
		if (!this.userFirst){//ユーザーが後攻のとき
			this.computer();
		}
	}
	
	print_board(){
		let str="<table>";
		for (let i = 0; i <this.n; i++){
			str+="<tr>";
			for (let j = 0; j <this.n; j++){
				let ch=this.BLANK_DISP;
				if (this.board[i][j]==this.BLACK){
					ch=this.BLACK_DISP;
				}else if(this.board[i][j]==this.WHITE){
					ch=this.WHITE_DISP;
				}
				str+='<td id="'+i+','+j+ '" onclick="onclickTd(this);">' + ch + "</td>";
			}
			str+="</tr>";
		}
		str+="</table>";
		str+='<div style="background: lightgray; width: 345px;">';
		str+="<p>"+(this.blackFlag ? this.BLACK_DISP: this.WHITE_DISP)+"の番</p>"
		switch(this.gameStatus){
			case this.PLAY:
				str+="<p>Status: 対戦中</p>";
				break;
			case this.BLACK_WIN:
				str+="<p>Status: "+this.BLACK_DISP+"の勝ち</p>";
				break;
			case this.WHITE_WIN:
				str+="<p>Status: "+this.WHITE_DISP+"の勝ち</p>";
				break;
			case this.DRAW:
				str+="<p>Status: 引き分け</p>";
				break;
		}
		str+="</div>";
		return str;
	}

	// 置くことができる場所があるかどうか
	canPut() {
		for (let i = 0; i < this.n; i++) {
			for (let j = 0; j < this.n; j++) {
				if (this.setable(i, j)) {
					return true;
				}
			}
		}
		return false;
	}
	// (i,j)に石が置けるかどうか
	setable(i, j) {
		if (i < 0 || i >= this.n || j < 0 || j >= this.n) {//範囲外
			return false;
		}
		if (this.board[i][j] != 0) {//空白じゃない
			return false;
		}
		if (this.setableVec(i, j, 1, 0) || this.setableVec(i, j, 0, 1) || this.setableVec(i, j, -1, 0) || this.setableVec(i, j, 0, -1)
				|| this.setableVec(i, j, 1, 1) || this.setableVec(i, j, -1, -1) || this.setableVec(i, j, 1, -1) || this.setableVec(i, j, -1, 1)) {//各方向に関して
			return true;
		}
		return false;
	}
	// (vecI,vecJ)方向に対して(i,j)に置けるかどうか
	setableVec(i, j, vecI, vecJ) {
		let color = this.blackFlag ? this.BLACK : this.WHITE;
		//進める
		i += vecI;
		j += vecJ;
		if (i < 0 || i >= this.n || j < 0 || j >= this.n) {//範囲外
			return false;
		}
		if (this.board[i][j] == color || this.board[i][j] == this.BLANK) {//同じ色か空白
			return false;
		}
		i += vecI;
		j += vecJ;
		while (i >= 0 && i < this.n && j >= 0 && j < this.n) {
			if (this.board[i][j] == this.BLANK) {//空白があったら
				return false;
			}
			if (this.board[i][j] == color) {//自分の色
				return true;
			}
			//進めていく
			i += vecI;
			j += vecJ;
		}
		return false;
	}

	// α-β法
	// flag AIの番かどうか
	// level 先読みの手数
	// alpha α値。このノードの評価値はα以上。
	// beta β値。このノードの評価値はβ以下。
	// 最終的に(bestI+bestJ*N)を返す。子ノードでは、その評価値を返す。
	alphaBeta(flag, level, alpha, beta) {
		let value;//ノードの評価値
		let childValue;//子ノードから伝わってきた評価値
		let bestI = 0, bestJ = 0;
		if (level <= 0 || !this.canPut()) {
			return this.valueBoard();
		}
		if (flag) {
			value = -Infinity;//AIの番では最大の評価値を見つけたい
		} else {
			value = Infinity;//AIの番でないときは最小の評価値を見つけたい
		}
		for (let i = 0; i < this.n; i++) {
			for (let j = 0; j < this.n; j++) {
				if (this.setable(i, j)) {
					let undo = new Undo(i, j);
					this.putOn(i, j);
					this.reverse(undo);
					this.nextTurn();
					childValue = this.alphaBeta(!flag, (level - 1), alpha, beta);//再帰
					if (flag) {
						if (childValue > value) {
							value = childValue;
							alpha = value;//α値を更新
							bestI = i;
							bestJ = j;
						}
						if (value > beta) {//βカット
							this.undoBoard(undo);
							return value;
						}
					} else {
						if (childValue < value) {
							value = childValue;
							beta = value;//β値を更新
							bestI = i;
							bestJ = j;
						}
						if (value < alpha) {//αカット
							this.undoBoard(undo);
							return value;
						}
					}
					this.undoBoard(undo);
				}
			}
		}
		if (level == this.serchLevel) {
			return bestI + bestJ * this.n;
		} else {
			return value;
		}
	}
	
	// (undo.i,undo.j)から石を取り除く(元に戻す)
	undoBoard(undo) {
		for (let pos of undo.position){
			let i = pos[0];
			let j = pos[1];
			this.board[i][j] *= -1;//BLACK=-WHITEである
		}
		this.board[undo.i][undo.j] = this.BLANK;//置いた場所を空白に
		this.nextTurn();
	}
	
	//次のターン
	nextTurn() {
		this.blackFlag = !this.blackFlag;
	}


	// (vecI,vecJ)方向に対して(undo.i,undo.j)に置いた場合の反転
	reverseVec(undo, vecI, vecJ) {
		let color = (this.blackFlag) ? this.BLACK : this.WHITE;
		let i = undo.i, j = undo.j;
		//進める
		i += vecI;
		j += vecJ;
		while (this.board[i][j] != color) {//自分の色が来るまで
			this.board[i][j] = color;
			undo.position.push([i, j]);
			//進める
			i += vecI;
			j += vecJ;
		}
	}

	// (i,j)に石を置く
	putOn(i, j) {
		let color = (this.blackFlag) ? this.BLACK : this.WHITE;
		this.board[i][j] = color;
	}

	reverse(undo) {
		if (this.setableVec(undo.i, undo.j, 1, 0)) {
			this.reverseVec(undo, 1, 0);
		}
		if (this.setableVec(undo.i, undo.j, 0, 1)) {
			this.reverseVec(undo, 0, 1);
		}
		if (this.setableVec(undo.i, undo.j, -1, 0)) {
			this.reverseVec(undo, -1, 0);
		}
		if (this.setableVec(undo.i, undo.j, 0, -1)) {
			this.reverseVec(undo, 0, -1);
		}
		if (this.setableVec(undo.i, undo.j, 1, 1)) {
			this.reverseVec(undo, 1, 1);
		}
		if (this.setableVec(undo.i, undo.j, -1, -1)) {
			this.reverseVec(undo, -1, -1);
		}
		if (this.setableVec(undo.i, undo.j, 1, -1)) {
			this.reverseVec(undo, 1, -1);
		}
		if (this.setableVec(undo.i, undo.j, -1, 1)) {
			this.reverseVec(undo, -1, 1);
		}
	}

	getCount() {
		let blackCount=0, whiteCount=0;
		for (let i = 0; i < this.n; i++) {
			for (let j = 0; j < this.n; j++) {
				if (this.board[i][j] == this.BLACK) {
					blackCount++;
				}
				if (this.board[i][j] == this.WHITE) {
					whiteCount++;
				}
			}
		}
		return [blackCount, whiteCount];
	}
	
	// 勝ち負け判定
	updateStatus() {
		let blackCount = this.counter[0];
		let whiteCount = this.counter[1];
		if (blackCount == 0) {
			this.gameStatus = this.WHITE_WIN;
		} else if (whiteCount == 0) {
			this.gameStatus = this.BLACK_WIN;
		}
		if (blackCount + whiteCount == this.n*this.n || this.passPass) {
			if (blackCount > whiteCount) {
				this.gameStatus = this.BLACK_WIN;
			} else if (blackCount < whiteCount) {
				this.gameStatus = this.WHITE_WIN;
			} else {
				this.gameStatus = this.DRAW;
			}
		}
	}

	computer() {
		let temp = this.alphaBeta(true, this.serchLevel, -Infinity, Infinity);//α-β法:返り値は bestI+bestJ*n
		let i = temp % this.n, j = Math.floor(temp / this.n);
		let undo = new Undo(i, j);
		this.putOn(i, j);
		this.reverse(undo);
		this.counter = this.getCount();
		this.updateStatus();
		this.nextTurn();
		update();
		if (!this.canPut() && this.gameStatus == this.PLAY) {//相手(プレイヤー)がパスなら
			alert("ユーザーはパスです");
			this.nextTurn();
			if (!this.canPut()) {
				this.passPass = true;
				this.updateStatus();
			}
			update();
			this.computer();
		}
	}

	//石の数によって評価値を決定する
	valueBoardManyStone() {
		let counter = this.getCount();
		if (this.userFirst) {
			return counter[1];
		} else {
			return counter[0];
		}
	}

	valueBoard() {
		if (this.n == 8) {
			let value = 0;
			//評価値は碁盤全体の状態により決まる
			for (let i = 0; i < this.n; i++) {
				for (let j = 0; j < this.n; j++) {
					value += this.board[i][j] * this.placeValue[i][j];
				}
			}
			if (this.userFirst) {
				return -value;//AIが白の時
			} else {
				return value;//AIが黒の時
			}
		} else {
			return valueBoardManyStone();
		}
	}

}

class Undo {
	
	constructor(i, j) {
		this.i = i;
		this.j = j;
		this.position = [];
	}
}
