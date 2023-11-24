const JUMPSPEED = 18, GRAVITY = 1, JUMPMAX = 3, WIDTH = 1000, HEIGHT = 700, STAGE = 11, PLAYER_SIZE = 20;
const WIDTH_VIEW = WIDTH * 0.65, HEIGHT_VIEW = HEIGHT * 0.65;

class Player {
    constructor() {
        this.initialize();
    }
    initialize() {
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
}

class Stage {
    constructor() {
        this.initialize();
    }
    initialize() {
        this.select = 0;
        this.width = [];
        this.ys = [];
        this.x = 0;
        this.spring_index = new Set();
        this.setv(0, 0);
    }

    setv(vx, vy) {
        this.vx = vx;
        this.vy = vy;
    }

    x_end(k) {
        let sum = this.x;
        for (let i = 0; i <= k; i++)
            sum += this.width[i];
        return sum;
    }

    x_start(k) {
        let sum = this.x;
        for (let i = 0; i < k; i++)
            sum += this.width[i];
        return sum;
    }
}


class Jump {
    constructor() {
        this.initialize();
    }
    initialize() {
        this.stage = [new Stage(), new Stage()];
        this.player = new Player();
        this.bit = 0;
        this.jumpcount = 0;
        //
        this.gameover = true;
        this.left = false;
        this.right = false;

        this.player.setxy(100, HEIGHT - 200);
        this.player.setv(0, 0);
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
                this.stage[i].ys = [HEIGHT - 200 + PLAYER_SIZE];
                this.stage[i].width = [WIDTH];
                this.stage[i].spring_index.clear();
                break;
            case 0:
                this.stage[i].width = [200, 100, 200, 100, 200];
                this.stage[i].ys = [500, HEIGHT + PLAYER_SIZE, 400, HEIGHT + PLAYER_SIZE, 300];
                this.stage[i].spring_index.clear();
                break;
            case 1:
                this.stage[i].width = [200, 100, 200, 100, 200];
                this.stage[i].ys = [300, HEIGHT + PLAYER_SIZE, 400, HEIGHT + PLAYER_SIZE, 500];
                this.stage[i].spring_index.clear();
                break;
            case 2:
                this.stage[i].width = [160, 160, 160, 160, 160, 160];
                this.stage[i].ys = [300, 350, 400, 450, 500, 550];
                this.stage[i].spring_index.clear();
                break;
            case 3:
                this.stage[i].width = [160, 160, 160, 160, 160, 160];
                this.stage[i].ys = [600, 550, 500, 450, 400, 350];
                this.stage[i].spring_index.clear();
                break;
            case 4:
                this.stage[i].width = [450, 100, 450];
                this.stage[i].ys = [600, HEIGHT + PLAYER_SIZE, 600];
                this.stage[i].spring_index.clear();
                break;
            case 5:
                this.stage[i].width = [450, 100, 450];
                this.stage[i].ys = [400, HEIGHT + PLAYER_SIZE, 400];
                this.stage[i].spring_index.clear();
                break;
            case 6:
                this.stage[i].width = [450, 100, 450];
                this.stage[i].ys = [200, HEIGHT + PLAYER_SIZE, 200];
                this.stage[i].spring_index.clear();
                break;
            case 7:
                this.stage[i].width = [200, 450, 200];
                this.stage[i].ys = [200, HEIGHT + PLAYER_SIZE, 200];
                this.stage[i].spring_index.clear();
                break;
            case 8:
                this.stage[i].width = [200, 450, 200];
                this.stage[i].ys = [400, HEIGHT + PLAYER_SIZE, 400];
                this.stage[i].spring_index.clear();
                break;
            case 9:
                this.stage[i].width = [200, 450, 200];
                this.stage[i].ys = [600, HEIGHT + PLAYER_SIZE, 600];
                this.stage[i].spring_index.clear();
                break;
            case 10:
                this.stage[i].width = [200, 600, 200];
                this.stage[i].ys = [650, HEIGHT + PLAYER_SIZE, 650];
                this.stage[i].spring_index = new Set([0, 2]);
                break;
        }
    }

    press_left() {
        this.player.x -= 2;
    }

    press_right() {
        this.player.x += 2;
    }


    run() {
        if (this.left)
            this.press_left();
        if (this.right)
            this.press_right();

        this.player.y += this.player.vy;
        this.player.vy += GRAVITY;
        this.score -= (this.stage[0].vx + this.stage[1].vx) / 2;
        this.player.x += this.player.vx;
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

        if (this.player.x + PLAYER_SIZE < 0 || this.player.y > HEIGHT)
            this.gameover = true;

        if (this.stage[this.bit].x < 0) {
            this.bit = (this.bit + 1) % 2;
            this.stage[this.bit].x = WIDTH;
            this.stage_select(this.bit, this.rand());
        }
        //壁
        let hit = false;
        for (let i = 0; i < 2; i++) {
            for (let k = 0; k < this.stage[i].ys.length; k++) {
                if (this.stage[i].x_start(k) < this.player.x + PLAYER_SIZE && this.player.x + PLAYER_SIZE < this.stage[i].x_start(k) + 10
                    && this.stage[i].ys[k] - PLAYER_SIZE < this.player.y + PLAYER_SIZE) {
                    this.player.vx = this.stage[i].vx - 10;
                    this.player.vy = -20;
                    hit = true;
                }
            }
        }
        //着地
        if (this.player.vy > 0 && !hit) {
            for (let i = 0; i < 2; i++) {
                for (let k = 0; k < this.stage[i].ys.length; k++) {
                    if (this.player.y + PLAYER_SIZE > this.stage[i].ys[k]
                        && this.stage[i].x_start(k) < this.player.x + PLAYER_SIZE && this.player.x < this.stage[i].x_end(k)) {
                        this.player.y = this.stage[i].ys[k] - PLAYER_SIZE;
                        this.player.vy = 0;
                        this.jumpcount = 0;
                        if (this.stage[i].spring_index.has(k))
                            this.player.vy = -40;
                    }
                }
            }
        }
    }

    makeSVG() {
        let svgStr = `<svg viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH_VIEW}" height="${HEIGHT_VIEW}">`;
        // 全部塗りつぶし
        svgStr += `<rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="lightgray"/>`;

        //ステージ描画
        for (let i = 0; i < 2; i++) {
            for (let k = 0; k < this.stage[i].ys.length; k++) {
                svgStr += `<rect x="${this.stage[i].x_start(k)}" y="${this.stage[i].ys[k]}" width="${this.stage[i].width[k]}" height="${HEIGHT}" fill="black"/>`;
                if (this.stage[i].spring_index.has(k)) {
                    for (let s = 1; s < 5; s++) {
                        svgStr += `<rect x="${this.stage[i].x_start(k)}" y="${this.stage[i].ys[k] - 5 * s}" width="${this.stage[i].width[k]}" height="${2}" fill="black"/>`;
                    }
                }
            }
        }


        if (!this.gameover) {
            const colors = ["blue", "green", "yellow", "red"];
            svgStr += `<rect x="${this.player.x}" y="${this.player.y}" width="${PLAYER_SIZE}" height="${PLAYER_SIZE}" fill="${colors[Math.min(this.jumpcount, colors.length - 1)]}"/>`;
        }

        svgStr += `<text x="${50}" y="${100}" font-size="55" text-anchor="start" fill="blue" stroke="white" font-weight="bold">${Math.floor(this.score / 10)}m</text>`;

        //ゲームオーバー
        if (this.gameover) {
            this.stage[0].vx = 0;
            this.stage[1].vx = 0;
            if (this.score / 10 > 1) {
                svgStr += `<text x="${WIDTH / 2}" y="${HEIGHT / 2}" font-size="120" text-anchor="middle" fill="red" stroke="white" font-weight="bold">GAME OVER</text>`;
            }
            svgStr += `<text x="${WIDTH / 2}" y="${HEIGHT / 2 + 160}" font-size="60" text-anchor="middle" fill="green" stroke="white" font-weight="bold">ENTERキーでSTART</text>`;
            svgStr += `<text x="${WIDTH / 2}" y="${HEIGHT / 2 + 160 + 60}" font-size="60" text-anchor="middle" fill="green" stroke="white" font-weight="bold">SPACEでJUMP</text>`;
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
            jump.jumpcount++;
            if (jump.jumpcount < JUMPMAX + 1)
                jump.player.vy = -JUMPSPEED;
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
        jump.jumpcount++;
        if (jump.jumpcount < JUMPMAX + 1)
            jump.player.vy = -JUMPSPEED;
    }
});

setInterval(() => {
    jump.run();
    draw.innerHTML = jump.makeSVG();
}, 25);
