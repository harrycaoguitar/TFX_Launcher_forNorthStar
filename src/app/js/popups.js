/* One interruptible motion owner for pages and dialogs. Page snapshots belong to
 * the compositor, so outgoing content never duplicates controls or scrollbars. */
const VyraMotion = (() => {
	const motions = new Map();
	const reduced = matchMedia('(prefers-reduced-motion: reduce)');
	const canMove = element => !document.hidden && !reduced.matches && typeof element.animate === 'function';
	const frame = element => {
		const style = getComputedStyle(element);
		return {opacity: style.opacity, transform: style.transform === 'none' ? 'translateY(0px)' : style.transform};
	};
	function cancel(element) {
		const running = motions.get(element);
		if (!running) return;
		motions.delete(element);
		running.animation.cancel();
		delete element.dataset.vyraMotion;
		running.onCancel?.();
	}
	function play(element, start, end, {duration, phase, easing = 'cubic-bezier(.22,.8,.25,1)', onFinish, onCancel} = {}) {
		cancel(element);
		if (!canMove(element)) { onFinish?.(); return null; }
		const animation = element.animate([start, end], {duration, easing, fill: 'both'});
		const running = {animation, onCancel, finish() {
			if (motions.get(element) !== running) return;
			motions.delete(element);
			delete element.dataset.vyraMotion;
			onFinish?.();
			animation.cancel();
		}};
		motions.set(element, running);
		element.dataset.vyraMotion = phase;
		animation.finished.then(running.finish, () => {});
		return animation;
	}
	function reveal(element, {duration = 320, offset = 16} = {}) {
		if (!element) return null;
		const start = motions.has(element) ? frame(element) : {opacity: 0, transform: `translateY(${offset}px)`};
		return play(element, start, {opacity: 1, transform: 'translateY(0px)'}, {duration, phase: 'entering'});
	}
	function changePage(previous, next, update) {
		if (previous) cancel(previous);
		update();
		if (previous && previous !== next) reveal(next);
		return null;
	}
	function finishAll() {
		for (const running of [...motions.values()]) running.finish();
	}
	// Hidden windows and reduced motion should never leave a pending visual layer.
	document.addEventListener('visibilitychange', () => { if (document.hidden) finishAll(); });
	reduced.addEventListener('change', () => { if (reduced.matches) finishAll(); });
	return Object.freeze({reveal, changePage, cancel, finishAll, frame, play, get activeCount() { return motions.size; }});
})();
window.VyraMotion = VyraMotion;

let popups = {};
let popupBatch = 0;
function syncPopupOverlay() {
	if (popupBatch) return;
	const visible = Boolean(document.querySelector('.popup.shown'));
	if (overlay.classList.contains('shown') === visible) return;
	const start = VyraMotion.frame(overlay);
	overlay.classList.toggle('shown', visible);
	VyraMotion.play(overlay, {opacity: start.opacity}, {opacity: visible ? 1 : 0}, {
		duration: visible ? 180 : 150, phase: visible ? 'entering' : 'leaving'
	});
}

popups.set = (popup, state, auto_close_all = true) => {
	const popup_el = typeof popup === 'string' ? document.querySelector(popup) : popup;
	if (!popup_el) return false;
	const wasShown = popup_el.classList.contains('shown');
	state = typeof state === 'boolean' ? state : !wasShown;
	if(window.Settings?.saving)return wasShown;
	if (wasShown === state) return state;
	const settingsShown=document.getElementById('options')?.classList.contains('shown');
	if (settingsShown && ((popup_el.id==='options' && !state) || (state && auto_close_all && popup_el.id!=='options')) && window.Settings?.canLeave && !Settings.canLeave(() => popups.set(popup_el,state,auto_close_all))) return wasShown;
	// Capture before changing classes, including a partially completed close.
	const start = VyraMotion.frame(popup_el);
	VyraMotion.cancel(popup_el);
	popup_el.classList.remove('vyra-popup-leaving');
	popup_el.classList.toggle('shown', state);
	popup_el.inert = !state;
	popup_el.setAttribute('aria-hidden', String(!state));
	if (state && auto_close_all) {
		// The next dialog is already shown, so closing its predecessor keeps the
		// backdrop and the original return-focus target continuous.
		popupBatch++;
		popups.set_all(false, popup_el);
		popupBatch--;
	}
	if (!state) popup_el.classList.add('vyra-popup-leaving');
	VyraMotion.play(popup_el, start, {opacity: state ? 1 : 0, transform: state ? 'translateY(0px) scale(1)' : 'translateY(10px) scale(.99)'}, {
		duration: state ? 320 : 190, phase: state ? 'entering' : 'leaving',
		onFinish: () => popup_el.classList.remove('vyra-popup-leaving')
	});
	syncPopupOverlay();
	events.emit('popup-changed', {popup: popup_el, new_state: state});
	return state;
};

popups.show = (popup, auto_close_all = true) => popups.set(popup, true, auto_close_all);
popups.hide = (popup, auto_close_all = true) => popups.set(popup, false, auto_close_all);
popups.list = () => document.querySelectorAll('.popup');
popups.set_all = (state, exclude_popup) => {
	popupBatch++;
	for (const popup of document.querySelectorAll('.popup.shown')) {
		if (popup !== exclude_popup) popups.set(popup, false, false);
	}
	popupBatch--;
	syncPopupOverlay();
};
for (const popup of popups.list()) popup.inert = !popup.classList.contains('shown');
