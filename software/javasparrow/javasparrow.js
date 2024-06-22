const JUMPSPEED = 18, GRAVITY = 1.1, WIDTH = 1000, HEIGHT = 700, STAGE = 8, BIRD_SIZE = 200;
const WIDTH_VIEW = WIDTH * 0.65, HEIGHT_VIEW = HEIGHT * 0.65;

// const DEBUG = true;
const DEBUG = false;

// const judge_box = document.getElementById("judge_box");

class Bird {
    constructor() {
        this.initialize();
    }
    initialize() {
        this.index = 0;
        this.setxy(0, 0);
        this.setv(0, 0);
    }

    setxy(x, y) {
        this.x = x;
        this.y = y;
    }

    setv(vx, vy) {
        this.vx = vx;
        this.vy = vy;
    }

    step() {
        // 描画スピード
        this.index = (this.index + 1) % 12;
    }

    get_image() {
        return this.index < 6 ? "javasparrow0.svg" : "javasparrow1.svg";
    }

    get_y_upper() {
        return this.y + BIRD_SIZE * 0.36;
    }
    get_y_lower() {
        return this.y + BIRD_SIZE * 0.59;
    }

    get_x_left() {
        return this.x + BIRD_SIZE * 0.33;
    }
    get_x_right() {
        return this.x + BIRD_SIZE * 0.88;
    }
}

class Stage {
    constructor() {
        this.initialize();
    }
    initialize() {
        this.select = 0;
        this.xs = [];
        this.y_lower = [];
        this.x = 0;
        this.setv(0, 0);
    }

    setv(vx, vy) {
        this.vx = vx;
        this.vy = vy;
    }

    get_x(k) {
        return this.xs[k] + this.x;
    }
}


class Jump {
    constructor() {
        this.initialize();
    }
    initialize() {
        this.stage = [new Stage(), new Stage()];
        this.bird = new Bird();
        this.bit = 0;
        //
        this.gameover = true;
        this.left = false;
        this.right = false;

        this.bird.setxy(100, HEIGHT / 5);
        this.bird.setv(0, 0);
        this.score = 0;

        this.stage[this.bit].x = 0;
        for (let i = 0; i < 2; i++) {
            this.stage[i].setv(-4, 0);
            this.stage_select(i, -1);
        }
    }

    stage_select(i, number) {
        this.stage[i].select = number;
        switch (number) {
            case -1:// 初期のみ
                this.stage[i].xs = [];
                this.stage[i].y_lower = [];
                break;
            case 0:
                this.stage[i].xs = [WIDTH * 0.1, WIDTH * 0.3, WIDTH * 0.5, WIDTH * 0.7, WIDTH * 0.9];
                this.stage[i].y_upper = [HEIGHT * 0.1, HEIGHT * 0.2, HEIGHT * 0.3, HEIGHT * 0.2, HEIGHT * 0.1];
                this.stage[i].y_lower = [HEIGHT * 0.6, HEIGHT * 0.7, HEIGHT * 0.8, HEIGHT * 0.7, HEIGHT * 0.6];
                break;
            case 1:
                this.stage[i].xs = [WIDTH * 0.1, WIDTH * 0.3, WIDTH * 0.5, WIDTH * 0.7, WIDTH * 0.9];
                this.stage[i].y_upper = [HEIGHT * 0.2, HEIGHT * 0.3, HEIGHT * 0.4, HEIGHT * 0.3, HEIGHT * 0.2];
                this.stage[i].y_lower = [HEIGHT * 0.7, HEIGHT * 0.8, HEIGHT * 0.9, HEIGHT * 0.8, HEIGHT * 0.7];
                break;
            case 2:
                this.stage[i].xs = [WIDTH * 0.1, WIDTH * 0.3, WIDTH * 0.5, WIDTH * 0.7, WIDTH * 0.9];
                this.stage[i].y_upper = [HEIGHT * 0.1, HEIGHT * 0.2, HEIGHT * 0.3, HEIGHT * 0.4, HEIGHT * 0.5];
                this.stage[i].y_lower = [HEIGHT * 0.6, HEIGHT * 0.7, HEIGHT * 0.8, HEIGHT * 0.9, HEIGHT * 1.0];
                break;
            case 3:
                this.stage[i].xs = [WIDTH * 0.1, WIDTH * 0.3, WIDTH * 0.5, WIDTH * 0.7, WIDTH * 0.9];
                this.stage[i].y_upper = [HEIGHT * 0.5, HEIGHT * 0.4, HEIGHT * 0.3, HEIGHT * 0.2, HEIGHT * 0.1];
                this.stage[i].y_lower = [HEIGHT * 1.0, HEIGHT * 0.9, HEIGHT * 0.8, HEIGHT * 0.7, HEIGHT * 0.6];
                break;
            case 4:
                this.stage[i].xs = [WIDTH * 0.2, WIDTH * 0.5, WIDTH * 0.8];
                this.stage[i].y_upper = [HEIGHT * 0.1, HEIGHT * 0.3, HEIGHT * 0.5];
                this.stage[i].y_lower = [HEIGHT * 0.5, HEIGHT * 0.7, HEIGHT * 0.9];
                break;
            case 5:
                this.stage[i].xs = [WIDTH * 0.2, WIDTH * 0.5, WIDTH * 0.8];
                this.stage[i].y_upper = [HEIGHT * 0.5, HEIGHT * 0.3, HEIGHT * 0.1];
                this.stage[i].y_lower = [HEIGHT * 0.9, HEIGHT * 0.7, HEIGHT * 0.5];
                break;
            case 6:
                this.stage[i].xs = [WIDTH * 0.2, WIDTH * 0.5, WIDTH * 0.8];
                this.stage[i].y_upper = [HEIGHT * 0.1, HEIGHT * 0.5, HEIGHT * 0.1];
                this.stage[i].y_lower = [HEIGHT * 0.5, HEIGHT * 0.9, HEIGHT * 0.5];
                break;
            case 7:
                this.stage[i].xs = [WIDTH * 0.2, WIDTH * 0.5, WIDTH * 0.8];
                this.stage[i].y_upper = [HEIGHT * 0.5, HEIGHT * 0.1, HEIGHT * 0.5];
                this.stage[i].y_lower = [HEIGHT * 0.9, HEIGHT * 0.5, HEIGHT * 0.9];
                break;
            }
    }

    press_left() {
        this.bird.x -= 2;
    }

    press_right() {
        this.bird.x += 2;
    }


    run() {
        this.bird.step();
        if (this.gameover)
            return;

        if (this.left)
            this.press_left();
        if (this.right)
            this.press_right();

        this.bird.y += this.bird.vy;
        this.bird.vy += GRAVITY;
        this.score -= (this.stage[0].vx + this.stage[1].vx) / 2;
        this.bird.x += this.bird.vx;
        this.stage[0].x += this.stage[0].vx;
        this.stage[1].x += this.stage[1].vx;

        for (let k = 0; k < 7; k++) {
            // だんだん速くなる
            if (!this.gameover && this.score / 10 > (k + 1) * 250 && this.score / 10 < 250 * (k + 2)) {
                for (let i = 0; i < 2; i++) {
                    this.stage[i].vx = -5 - k;
                }
            }
        }

        if (this.bird.get_x_left() < 0 || this.bird.get_x_right() > WIDTH || this.bird.get_y_lower() > HEIGHT || this.bird.get_y_upper() < 0)
            this.gameover = true;

        if (this.stage[this.bit].x < 0) {
            this.bit = (this.bit + 1) % 2;
            this.stage[this.bit].x = WIDTH;
            this.stage_select(this.bit, this.rand());
        }
        //壁
        for (let i = 0; i < 2; i++) {
            for (let k = 0; k < this.stage[i].y_lower.length; k++) {
                if (this.stage[i].get_x(k) > this.bird.get_x_left() && this.bird.get_x_right() > this.stage[i].get_x(k)
                    && (this.stage[i].y_lower[k] < this.bird.get_y_lower() || this.stage[i].y_upper[k] > this.bird.get_y_upper())) {
                    this.bird.vx = 0;
                    this.bird.vy = 0;
                    this.gameover = true;
                }
            }
        }
    }

    makeSVG() {
        let svgStr = `<svg viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH_VIEW}" height="${HEIGHT_VIEW}">`;
        // 全部塗りつぶし
        svgStr += `<rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="lightblue"/>`;

        //ステージ描画
        for (let i = 0; i < 2; i++) {
            if (DEBUG) {
                svgStr += `<text x="${this.stage[i].x}" y="${50}" font-size="55" text-anchor="start" fill="red" stroke="white" font-weight="bold">${this.stage[i].select}</text>`;
            }
            for (let k = 0; k < this.stage[i].y_lower.length; k++) {
                svgStr += `<rect x="${this.stage[i].get_x(k)}" y="${this.stage[i].y_lower[k]}" width="10" height="${HEIGHT}" fill="black"/>`;
                svgStr += `<rect x="${this.stage[i].get_x(k)}" y="${0}" width="10" height="${this.stage[i].y_upper[k]}" fill="black"/>`;
            }
        }


        svgStr += `<image href="${this.bird.get_image()}" x="${this.bird.x}" y="${this.bird.y}" width="${BIRD_SIZE}" height="${BIRD_SIZE}"/>`;

        if (DEBUG 
            // || judge_box.checked
        ) {
            svgStr += `<rect x="${this.bird.get_x_left()}" y="${this.bird.get_y_upper()}" width="${this.bird.get_x_right() - this.bird.get_x_left()}" height="${this.bird.get_y_lower() - this.bird.get_y_upper()}" fill="none" stroke="red" stroke-width="2"/>`;
        }

        svgStr += `<text x="${50}" y="${100}" font-size="55" text-anchor="start" fill="blue" stroke="white" font-weight="bold">${Math.floor(this.score / 10)}m</text>`;

        //ゲームオーバー
        if (this.gameover) {
            this.stage[0].vx = 0;
            this.stage[1].vx = 0;
            if (this.score / 10 > 1) {
                svgStr += `<text x="${WIDTH / 2}" y="${HEIGHT / 2}" font-size="120" text-anchor="middle" fill="red" stroke="white" font-weight="bold">GAME OVER</text>`;
            }
            svgStr += `<text x="${WIDTH / 2}" y="${HEIGHT / 2 + 160}" font-size="60" text-anchor="middle" fill="magenta" stroke="white" font-weight="bold">ENTERキーでSTART</text>`;
            svgStr += `<text x="${WIDTH / 2}" y="${HEIGHT / 2 + 160 + 60}" font-size="60" text-anchor="middle" fill="magenta" stroke="white" font-weight="bold">SPACEでJUMP</text>`;
        }

        svgStr += "</svg>";
        return svgStr;
    }

    rand() {
        return Math.floor(Math.random() * STAGE);
    }
};

let jump = new Jump();

window.addEventListener("keydown", (e) => {
    console.log(e.key)
    switch (e.key) {
        case "Enter":
            if (jump.gameover) {
                jump.initialize();
                jump.gameover = false;
            }
            break;
        case " ":
            jump.bird.vy = -JUMPSPEED;
            break;
        case "ArrowLeft":
            jump.left = true;
            break;
        case "ArrowRight":
            jump.right = true;
            break;
    }

});

window.addEventListener("keyup", (e) => {
    switch (e.key) {
        case "ArrowLeft":
            jump.left = false;
            break;
        case "ArrowRight":
            jump.right = false;
            break;
    }
});

const draw = document.getElementById("draw");

window.addEventListener("click", () => {
    if (jump.gameover) {
        jump.initialize();
        jump.gameover = false;
    } else {
        jump.bird.vy = -JUMPSPEED;
    }
});

setInterval(() => {
    jump.run();
    draw.innerHTML = jump.makeSVG();
}, 25);
