let open = $state(false);

export const navPickerState = {
	get open() {
		return open;
	},
	set open(value: boolean) {
		open = value;
	},
	toggle() {
		open = !open;
	}
};
