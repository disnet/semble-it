let open = $state(false);
let swipeOffset = $state(0);
let swiping = $state(false);

export const sidebarState = {
	get open() {
		return open;
	},
	set open(value: boolean) {
		open = value;
	},
	toggle() {
		open = !open;
	},
	get swipeOffset() {
		return swipeOffset;
	},
	set swipeOffset(value: number) {
		swipeOffset = value;
	},
	get swiping() {
		return swiping;
	},
	set swiping(value: boolean) {
		swiping = value;
	}
};
