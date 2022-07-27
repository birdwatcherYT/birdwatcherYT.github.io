class Typing {
	constructor(words) {
		this.words = words;
		this.init(0);
	}

	init(problems) {
		this.problems = problems;
		this.word_count = 0;
		this.selected_word = null;
		this.char_index = 0;
		this.correct=0;
		this.mistake=0;
		this.start_time=null;
		this.end_time=null;
	}
	
	start(){
		this.next_word();
		this.start_time=performance.now();
	}
	
	end(){
		this.end_time=performance.now();
		this.next_word();
	}
	
	problem_end(){
		return (this.word_count>=this.problems);
	}
	
	next_word(){
		if (this.problem_end()){
			this.selected_word=null;
			return;
		}
		this.selected_word=this.random_select();
		this.word_count++;
		this.char_index=0;
	}
	
	word_end(){
		return (this.char_index>=this.selected_word.length);
	}
	
	check_char(ch){
		if(this.word_end())
			return null;
		if(this.selected_word[this.char_index]==ch){
			this.char_index++;
			this.correct++;
			return true;
		}
		this.mistake++;
		return false;
	}
	
	random_select(){
		let random = Math.floor(Math.random() * this.words.length);
		return this.words[random];
	}

	display(id){
		var output = document.getElementById(id);
		output.innerHTML="";
		if (this.selected_word == null){
			if (this.correct!=0){
				let milisec=(this.end_time-this.start_time);
				let sec=milisec/1000;
				output.innerHTML+="<h3>正解率: "+Math.round(100*this.correct/(this.correct+this.mistake))+"%</h3>";
				output.innerHTML+="<h3>時間: "+Math.round(milisec)/1000+"s</h3>";
				output.innerHTML+="<h3>タイプ速度: "+Math.round(1000*this.correct/sec)/1000+"文字/s</h3>";
				output.innerHTML+="<h3>正解タイプ数: "+this.correct+"文字</h3>";
				output.innerHTML+="<h3>ミスタイプ数: "+this.mistake+"文字</h3>";
			}
			output.innerHTML+="<h2><font color='blue'>Enterキーで開始</font></h2>";
			return;
		}
		output.innerHTML+="<h2>"+this.word_count+"/"+this.problems+"</h2>";
		output.innerHTML+="<h2><font color='gray'>"+this.selected_word.substr(0,this.char_index)+"</font>"
							+this.selected_word.substr(this.char_index)+"</h2>";
		output.innerHTML+="<p><font color='gray'>Escapeキーでトップに戻る</font></p>";
	}
};


let typing = new Typing(WORDS);
const id = "output";
let problems = document.getElementById("problems");
let sound = document.getElementById("sound");
// let input = document.getElementById("input");

typing.display(id);

const A_CODE="A".charCodeAt(0);
const Z_CODE="Z".charCodeAt(0);

window.AudioContext = window.AudioContext || window.webkitAudioContext;

let audio_ctx=null;

function beep(){
	if (audio_ctx==null)
		audio_ctx = new AudioContext();
	let freq=500;
	let time=0.1;
	let oscillator = audio_ctx.createOscillator();
	let current_time = audio_ctx.currentTime;
	oscillator.frequency.setValueAtTime(freq, time);
	current_time+=time;
	oscillator.connect(audio_ctx.destination);
	oscillator.start(audio_ctx.currentTime);
	oscillator.stop(current_time);
}


window.addEventListener("keydown", (e)=>{
	// input.value="";

	let code = e.keyCode;
	console.log(e.key);
	if (e.key=="Escape"){
		typing.init(problems.value);
		problems.disabled=false;
		typing.display(id);
		return;
	}
	if (typing.selected_word==null){
		if (e.key=="Enter"){
			typing.init(problems.value);
			problems.disabled=true;
			typing.start();
			console.log(typing.selected_word);
			typing.display(id);
		}
		return;
	}
	if(!(A_CODE<=code && code<=Z_CODE))
		return;
	if (typing.word_end())
		return;
	let correct = typing.check_char(e.key);
	console.log(correct);
	if (!correct && sound.checked)
		beep();
	if (typing.word_end()){
		typing.end();
		problems.disabled=false;
		console.log(typing.selected_word);
	}
	typing.display(id);
});
