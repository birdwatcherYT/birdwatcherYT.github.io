class PriorityQueue {

	constructor() {
		this.heap = [];
	}

	push(key, value) {
		const heap = this.heap;

		heap.push({ key: key, value: value });

		let child = heap.length - 1;
		while (child) {
			const parent = Math.floor((child - 1) / 2);
			if (heap[child].key >= heap[parent].key)
				break;
			[heap[child], heap[parent]] = [heap[parent], heap[child]];
			child = parent;
		}
	}

	pop() {
		const heap = this.heap;

		const top = heap[0];
		heap[0] = heap[heap.length - 1];
		heap.pop();

		let parent = 0;
		while (true) {
			let child = 2 * parent + 1;
			if (child >= heap.length)
				break;
			if (child + 1 < heap.length && heap[child + 1].key < heap[child].key)
				++child;
			if (heap[parent].key <= heap[child].key)
				break;
			[heap[child], heap[parent]] = [heap[parent], heap[child]];
			parent = child;
		}

		return top;
	}

	size() {
		return this.heap.length;
	}

	top() {
		return this.heap[0];
	}
};
