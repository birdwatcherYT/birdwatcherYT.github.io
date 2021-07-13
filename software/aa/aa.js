function img2pixel(img, char_num){
	// 画像をピクセルに変換
	const scale=char_num/img.width;
	let canvas = document.createElement("canvas");
	let context = canvas.getContext('2d');
	canvas.width = img.width*scale;
	canvas.height = img.height*scale;
	context.drawImage(img, 0, 0, img.width, img.height, 0, 0, canvas.width, canvas.height);
	let pixel=context.getImageData(0, 0, canvas.width, canvas.height);
	return pixel;
}

function draw_image(canvas, img){
	//画像描画
	let context = canvas.getContext('2d');
	canvas.width = img.width;
	canvas.height = img.height;
	context.drawImage(img, 0, 0);
}

function AA2img(canvas, AA, fontsize){
	// AAを画像出力
	const lines = AA.split("\n");
	canvas.width=text_width(lines[0],fontsize);
	canvas.height=fontsize*lines.length;
	let aa_ctx = canvas.getContext('2d');
	aa_ctx.font = fontsize+"px monospace";
	aa_ctx.textBaseline = "top";
	for (let k=0;k<lines.length;k++){
		let line = lines[k];
		aa_ctx.fillText(line, 0, fontsize*k);
	}
}

function text_width(text, fontsize){
	let canvas = document.createElement("canvas");
	let ctx = canvas.getContext('2d');
	ctx.font = fontsize+"px monospace";
	let width = ctx.measureText(text).width;
	return width;
}

function char2pixel(ch, fontsize){
	// 半角1文字の画像表現
	let canvas = document.createElement("canvas");
	canvas.width=text_width(ch,fontsize);
	canvas.height=fontsize;
	let ctx = canvas.getContext('2d');
	ctx.font = fontsize+"px monospace";
	ctx.textBaseline = "top";
	ctx.fillText(ch, 0, 0);
	let pixel=ctx.getImageData(0, 0, canvas.width, canvas.height);
	return pixel;
}


function character_density(characters, fontsize){
	// 文字の濃度を返す
	let chara2d=[];
	let c_vals=[];
	let max_val=0, min_val=255;
	for (let ch of characters){
		let c = char2pixel(ch, fontsize);
		chara2d.push(c);
		let char_H = c.height;
		let char_W = c.width;
		let total=0

		for (let i = 0; i < char_H; i++) {
			for (let j = 0; j < char_W; j++) {
				let c_idx = (j + i * char_W) * 4;
				let c_val = (c.data[c_idx] + c.data[c_idx + 1] + c.data[c_idx + 2]) / 3;
				let c_a = c.data[c_idx+3]/255;
				c_val = (255*(1-c_a) + c_val*c_a);
				total+=c_val;
			}
		}
		total = total/(char_H*char_W);
		c_vals.push(total);
		max_val = Math.max(max_val, total);
		min_val = Math.min(min_val, total);
	}
	if (max_val != min_val){
		for (let i=0; i<c_vals.length;i++){
			c_vals[i]=(c_vals[i]-min_val)*255/(max_val-min_val);
		}
	}
	return c_vals;
}

function toAA(img, size, characters, c_vals) {
	let height = img.height;
	let width = img.width;
	let char_H = size;
	let char_W = size/2;

	let AA="";
	for (let I = 0; I < Math.floor(height/char_H)*char_H; I+=char_H) {
		for (let J = 0; J < Math.floor(width/char_W)*char_W; J+=char_W) {
			//
			let loss_min=Infinity;
			let argmin;
			let mean=0;
			for (let i = 0; i < char_H; i++) {
				for (let j = 0; j < char_W; j++) {
					let idx = ((J+j) + (I+i) * width) * 4;
					let val = (img.data[idx] + img.data[idx + 1] + img.data[idx + 2]) / 3;
					let a = img.data[idx+3]/255;
					val = (255*(1-a) + val*a);
					mean+=val;
				}
			}
			mean /= char_H*char_W;
			for (let k = 0; k < characters.length; k++) {
				let loss = Math.abs(mean-c_vals[k]);
				if (loss<loss_min){
					loss_min=loss;
					argmin=characters[k];
				}
			}
			AA+=argmin;
		}
		AA+="\n";
	}
	return AA;
}
