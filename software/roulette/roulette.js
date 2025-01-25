class Roulette {
    constructor() {
        this.items = [
            { text: 'Item 1', weight: 1 },
            { text: 'Item 2', weight: 1 },
            { text: 'Item 3', weight: 1 },
        ];
        this.isSpinning = false;
        this.rotation = 0;

        // DOM elements
        this.wheel = document.getElementById('wheel');
        this.spinButton = document.getElementById('spinButton');
        this.shuffleButton = document.getElementById('shuffleButton');
        this.resultDiv = document.getElementById('result');
        this.newItemInput = document.getElementById('newItem');
        this.newItemWeightInput = document.getElementById('newItemWeight');
        this.addButton = document.getElementById('addButton');
        this.itemsList = document.getElementById('itemsList');

        // Bind event listeners
        this.spinButton.addEventListener('click', () => this.spin());
        this.shuffleButton.addEventListener('click', () => this.shuffle());
        this.addButton.addEventListener('click', () => this.addItem());
        this.newItemInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addItem();
        });

        this.render();
    }

    getTotalWeight() {
        return this.items.reduce((sum, item) => sum + item.weight, 0);
    }

    getWeightedAngle(index) {
        const totalWeight = this.getTotalWeight();
        const startWeight = this.items.slice(0, index).reduce((sum, item) => sum + item.weight, 0);
        const angle = (startWeight / totalWeight) * 360;
        return angle;
    }

    spin() {
        if (this.isSpinning) return;

        this.isSpinning = true;
        this.spinButton.disabled = true;
        this.resultDiv.classList.remove('visible');

        // 最低5回転する
        const minRotation = 360 * 5;
        const additionalRotation = Math.random() * 360;
        const totalRotation = this.rotation + minRotation + additionalRotation;
        this.wheel.style.transform = `rotate(${totalRotation}deg)`;
        this.wheel.style.transition = 'transform 5s cubic-bezier(0.2, 0, 0.2, 1)';

        setTimeout(() => {
            const degrees = totalRotation % 360;
            const normalizedDegree = (360 - degrees) % 360;

            let currentAngle = 0;
            let selectedItem = this.items[0];

            for (const item of this.items) {
                const itemAngle = (item.weight / this.getTotalWeight()) * 360;
                if (normalizedDegree >= currentAngle && normalizedDegree < currentAngle + itemAngle) {
                    selectedItem = item;
                    break;
                }
                currentAngle += itemAngle;
            }

            this.showResult(selectedItem.text);
            this.isSpinning = false;
            this.spinButton.disabled = false;
            this.rotation = degrees;
            this.wheel.style.transition = 'none';
            this.wheel.style.transform = `rotate(${degrees}deg)`;
        }, 5000);
    }

    addItem() {
        const text = this.newItemInput.value.trim();
        const weight = parseInt(this.newItemWeightInput.value, 10) || 1;

        if (weight >= 1) {
            this.items.push({ text, weight });
            this.newItemInput.value = '';
            this.newItemWeightInput.value = '1';
            this.render();
        }
    }

    removeItem(index) {
        if (this.items.length != 0) {
            this.items = this.items.filter((_, i) => i !== index);
            this.render();
        }
    }

    updateWeight(index, weight) {
        if (weight >= 1) {
            this.items[index].weight = weight;
            this.render();
        }
    }

    showResult(result) {
        this.resultDiv.textContent = `Result: ${result}`;
        this.resultDiv.classList.add('visible');
    }

    shuffle() {
        for (let i = this.items.length - 1; i > 0; --i) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.items[i], this.items[j]] = [this.items[j], this.items[i]];
        }
        this.render();
    }

    render() {
        this.wheel.innerHTML = '';
        const totalWeight = this.getTotalWeight();

        this.items.forEach((item, index) => {
            const itemElement = document.createElement('div');
            itemElement.className = 'wheel-item';

            const lineAngle = item.weight / totalWeight * 180;
            const textAngle = this.getWeightedAngle(index) + lineAngle;
            itemElement.style.transform = `rotate(${textAngle}deg)`;
            itemElement.textContent = item.text;

            const span = document.createElement('div');
            span.className = "line";
            span.style.transform = `rotate(${lineAngle}deg)`;
            itemElement.appendChild(span);

            this.wheel.appendChild(itemElement);
        });

        this.itemsList.innerHTML = '';
        this.items.forEach((item, index) => {
            const itemElement = document.createElement('div');
            itemElement.className = 'item';
            // <span>${item.text}</span>
            itemElement.innerHTML = ` 
              <div class="item-content">
                <input type="text" value="${item.text}" onchange="roulette.changeName(${index}, event);"/>
                <input
                  type="number"
                  class="weight-input"
                  value="${item.weight}"
                  min="1"
                  onchange="roulette.updateWeight(${index}, parseInt(this.value, 10))"
                />
                <span class="weight-label">(${Math.round(item.weight / this.getTotalWeight() * 100)}%)</span>
              </div>
              ${this.items.length > 1 ? `<button class="remove-button" onclick="roulette.removeItem(${index})">×</button>` : ''}
            `;
            this.itemsList.appendChild(itemElement);
        });
    }
    changeName(index, event) {
        this.items[index].text = event.target.value;
        this.render();
    }
}

const roulette = new Roulette();
