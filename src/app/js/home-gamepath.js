/* Keep the home directory card aligned with the selected game version. */
(() => {
	'use strict';
	function server() {
		if (window.Fold?.mode === 'vanilla') return 'official';
		return window.settings?.northstarRegion === 'global' ? 'global' : 'cn';
	}
	window.set_home_gamepath = () => server() === 'global' ? window.setglobalpath() : window.setpath();
	window.open_home_gamepath = () => server() === 'global' ? window.open_global_gamepath() : window.open_gamepath();
})();
