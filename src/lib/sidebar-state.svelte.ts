let open = $state(false);

export const sidebarState = {
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
