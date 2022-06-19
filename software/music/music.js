window.AudioContext = window.AudioContext || window.webkitAudioContext;

let oscillator;
let freqs=[0, 355, 0, 350, 460, 0, 460, 0, 460, 0];
let times=[0.1, 0.5, 0.1, 0.25, 0.2, 0.3, 0.2, 0.1, 0.5, 0.1];

function load_table(){
	for (let i=0; i<freqs.length; i++){
		let time_cell=document.getElementById('time'+i);
		times[i] = isNaN(time_cell.innerText) ? 0 : Number(time_cell.innerText);

		let freq_cell=document.getElementById('freq'+i);
		freqs[i] = isNaN(freq_cell.innerText) ? 0 : Number(freq_cell.innerText);
	}
}

function stop(){
	oscillator?.stop();
}

function play(){
	stop();
	load_table();

	let ctx = new AudioContext();
	oscillator = ctx.createOscillator();
	
	let type = document.getElementById("type").value;
	oscillator.type = type;
	let loop = document.getElementById("loop").value;
	
	let current_time = ctx.currentTime;
	for (let k=0; k<loop; k++)
	for (let i=0; i<freqs.length; i++){
		oscillator.frequency.setValueAtTime(freqs[i], current_time);
		current_time+=times[i];
	}
	oscillator.connect(ctx.destination);

	oscillator.start(ctx.currentTime);
	oscillator.stop(current_time);
}

function print_table(){
	str='<table> <tr bgcolor="lightblue"> <th>周波数 (Hz)</th> <th>時間 (sec)</th> </tr>'
	for (let i=0; i<freqs.length; i++){
		str+='<tr> <td id="freq'+i+'" contentEditable>'+freqs[i]+'</td><td id="time'+i+'" contentEditable>'+times[i]+'</td> </tr>';
	}
	str+='</table>';
	return str;
}

function update_table(){
	let output=document.getElementById("output");
	output.innerHTML = print_table();
}

function add_row(){
	load_table();
	freqs.push(0);
	times.push(0);
	update_table();
}

function delete_row(){
	if(freqs.length == 0)
		return;
	load_table();
	freqs.pop();
	times.pop();
	update_table();
}

