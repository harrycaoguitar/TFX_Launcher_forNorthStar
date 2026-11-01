var settings_fuse;

var Settings = {
	toggle: (state) => {
		const shown = document.getElementById("options").classList.contains("shown");
		const next = typeof state === "boolean" ? state : !shown;
		if (Settings.saving) return;
		if (next && shown) return;
		if (next) {
			const status = document.getElementById('settingsSaveStatus');
			if (status) {status.textContent='';status.hidden=true;}
			Settings.load();
			document.querySelector('#options .options').scrollTo(0, 0);
		}
		popups.set("#options", next);
		if (next) window.DDSGuard?.refresh();
	},
	saving: false,
	cleanSnapshot: null,
	markClean: () => {Settings.cleanSnapshot=JSON.stringify(Settings.get());},
	isDirty: () => Settings.cleanSnapshot!==null && Settings.cleanSnapshot!==JSON.stringify(Settings.get()),
	canLeave: (action) => {
		if (Settings.saving) return false;
		if (Settings.skipClosePrompt || !document.getElementById('options').classList.contains('shown') || !Settings.isDirty()) return true;
		Settings.unsaved?.ask(action); return false;
	},
	modStateError: (code, fallback) => ({
		busy:'settings.modStateChangeBlocked', GAME_RUNNING:'settings.modStateChangeBlocked',
		PROCESS_QUERY:'settings.modStateProcessUnknown', PROFILE_CHANGED:'settings.modStateContextChanged',
		AMBIGUOUS_MOD_PROFILE:'settings.modStateDuplicates', MOD_PROFILE_STATE:'settings.modStateInvalid',
		MOD_PROFILE_ROLLBACK:'settings.modStateRecoveryNeeded'
	})[code] || fallback,
	savePatch: async (patch) => {
		if (Settings.saving || window.mods?.pending?.size) return {ok:false,code:'busy'};
		const locks = new Map();
		for (const control of document.querySelectorAll('#options input,#options select,#options button')) {
			locks.set(control,control.disabled); control.disabled=true;
		}
		Settings.saving=true;
		window.dispatchEvent(new Event('tfx-settings-saving-changed'));
		try {
			const response=await ipcRenderer.invoke('settings-save',patch);
			if (response?.settings && typeof response.settings === 'object') settings={...response.settings};
			if (!response?.ok || !response.settings || Object.entries(patch).some(([key,value]) => response.settings[key]!==value)) return {ok:false,code:response?.code,error:response?.error};
			window.dispatchEvent(new CustomEvent('tfx-settings-persisted',{detail:{keys:Object.keys(patch)}}));
			return response;
		} catch (error) {
			return {ok:false,error:String(error?.message||error)};
		} finally {
			Settings.saving=false;
			for (const [control,disabled] of locks) if (control.isConnected) control.disabled=disabled;
			window.dispatchEvent(new Event('tfx-settings-saving-changed'));
		}
	},
	apply: async () => {
		if (Settings.saving) return false;
		const updated = Settings.get();
		const button=document.getElementById('apply'),status=document.getElementById('settingsSaveStatus');
		const locks=new Map();
		for(const control of document.querySelectorAll('#options input,#options select,#options button')){locks.set(control,control.disabled);control.disabled=true;}
		Settings.saving=true;button?.setAttribute('aria-busy','true');
		window.dispatchEvent(new Event('tfx-settings-saving-changed'));
		if(status){status.textContent=I18n.t('settings.savePending');status.hidden=false;status.classList.remove('is-error');}
		try {
			const response=await ipcRenderer.invoke('settings-save',updated);
			if(!response?.ok||!response.settings)throw Error(response?.error||I18n.t('settings.saveFailed'));
			settings={...response.settings};
			if(window.Themes)Themes.apply(settings.theme);
			if(window.I18n)I18n.commit(settings.uiLanguage);
			Settings.markClean();
			Settings.saving=false;Settings.toggle(false);
			return true;
		} catch(error) {
			if(status){status.textContent=I18n.t('settings.saveFailed');status.title=String(error?.message||error);status.classList.add('is-error');status.hidden=false;}
			return false;
		} finally {
			Settings.saving=false;button?.removeAttribute('aria-busy');
			for(const[control,disabled]of locks)if(control.isConnected)control.disabled=disabled;
			window.dispatchEvent(new Event('tfx-settings-saving-changed'));
		}
	},
	cancel: () => {
		if (window.Themes) Themes.cancel();
		if (window.I18n) I18n.cancel();
	},
	get: () => {
		let opts = {};
		let options = document.querySelectorAll(".option");

		for (let i = 0; i < options.length; i++) {
			let optName = options[i].getAttribute("name");
			if (options[i].querySelector(".actions input")) {
				let input = options[i].querySelector(".actions input").value;
				if (options[i].getAttribute("type")) {
					opts[optName] = input.trim().split(/\s+/u).filter(Boolean);
				} else {
					opts[optName] = input;
				}
			} else if (options[i].querySelector(".actions select")) {
				opts[optName] = options[i].querySelector(".actions select").value;
			} else if (options[i].querySelector(".actions .switch")) {
				if (options[i].querySelector(".actions .switch.on")) {
					opts[optName] = true;
				} else {
					opts[optName] = false;
				}
			}
		}

		if (window.Themes) opts.theme = Themes.normalize(Themes.current);
		return opts;
	},
	load: () => {
		window.dispatchEvent(new Event('tfx-settings-controls-sync'));
		if (window.I18n) I18n.load();
		if (window.Themes) Themes.load();
		const pathField = document.getElementById('settingsGamePath');
		if (pathField) { pathField.textContent = settings.gamepath || (window.I18n ? I18n.text('尚未选择游戏目录') : '尚未选择游戏目录'); pathField.title = pathField.textContent; }
		const globalPathField = document.getElementById('settingsGlobalGamePath');
		if (globalPathField) { globalPathField.textContent = settings.globalGamepath || (window.I18n ? I18n.t('settings.globalPathMissing') : '尚未选择国际服游戏目录'); globalPathField.title = globalPathField.textContent; }

		let options = document.querySelectorAll(".option");

		for (let i = 0; i < options.length; i++) {
			let optName = options[i].getAttribute("name");
			if (settings[optName] != undefined) {
				switch(typeof settings[optName]) {
					case "string":
						const field = options[i].querySelector(".actions input, .actions select");
						if (field) field.value = settings[optName];
						break
					case "object":
						options[i].querySelector(".actions input").value = settings[optName].join(" ");
						break
					case "boolean":
						let switchDiv = options[i].querySelector(".actions .switch");
						if (settings[optName]) {
							switchDiv.classList.add("on");
							switchDiv.classList.remove("off");
						} else {
							switchDiv.classList.add("off");
							switchDiv.classList.remove("on");
						}
						switchDiv.setAttribute('aria-checked', String(Boolean(settings[optName])));
						break

				}
			}
		}

		// create Fuse based on options from `get_search_arr()`
		settings_fuse = new Fuse(get_search_arr(), {
			keys: ["text"],
			threshold: 0.4,
			ignoreLocation: true
		})

		// reset search
		Settings.search();
		search_el.value = "";
		Settings.markClean();

	},
	switch: (el, state) => {
		if (!el) return;
		if (state) {
			return el.classList.add("on");
		} else if (state === false) {
			return el.classList.remove("on");
		}

		if (el.classList.contains("switch") && el.tagName == "BUTTON") {
			el.classList.toggle("on");
			el.classList.toggle("off", !el.classList.contains("on"));
			el.setAttribute('aria-checked', String(el.classList.contains('on')));
		}
	},

	// searches for `query` in the list of options, hides the options
	// that dont match, and shows the one that do, if `query` is falsy,
	// it'll simply reset everything back to being visible
	search: (query = "") => {
		// get list of elements that can be hidden
		let search_els = [
			...document.querySelectorAll(".options .title"),
			...document.querySelectorAll(".options .option"),
			...document.querySelectorAll(".options .buttons"),
			...document.querySelectorAll(".options .details"),
		]

		// this sets the visibility of all elements found in
		// `search_els` unless the element has the `perma-hidden`
		// attribute set
		let set_all = (state) => {
			// set `state` to the CSS equivalent
			if (state) {
				state = null;
			} else {
				state = "none";
			}

			// run through elements
			for (let i = 0; i < search_els.length; i++) {
				// check that the element shouldn't be perma hidden, and
				// if so, hide it correctly.
				if (search_els[i].hasAttribute("perma-hidden")) {
					search_els[i].style.display = "none";
					continue;
				}

				// set the visibility
				search_els[i].style.display = state;
			}
		}

		// check if `query` is empty, and reset search if so
		if (! query || ! query.trim()) {
			set_all(true);
		} else {
			// hide everything
			set_all(false);
		}

		// unhides `el` and relevant elements related to it
		let unhide = (el) => {
			const protection = el.closest('#ddsProtection');
			if (protection) {
				protection.style.display = null;
				protection.open = true;
				for (const row of protection.querySelectorAll('.title, .buttons')) {
					if (!row.hasAttribute('perma-hidden')) row.style.display = null;
				}
			}
			// list of elements that could be relevant through `el`'s
			// `.closest()` function
			let closest = [
				".option",
				"details",
				".buttons",
			]

			// run through `closest`
			for (let i = 0; i < closest.length; i++) {
				// shorthand
				let closest_el = el.closest(closest[i]);

				// was a relevant element found?
				if (closest_el) {
					// is it supposed to always be hidden? do nothing
					if (el.hasAttribute("perma-hidden")
						|| closest_el.hasAttribute("perma-hidden")) {

						break;
					}

					// reset visibility
					closest_el.style.display = null;

					// are we at a `<details>`?
					if (closest[i] == "details") {
						// attempt to get a `.title` inside that
						// `<details>` element
						let title = closest_el.querySelector(".title");

						// did we find a title?
						if (title) {
							// reset visibility of title and also reset
							// open state of `<details>`
							title.style.display = null;
							closest_el.setAttribute("open", false);
						}
					}
				}
			}
		}

		// do a Fuse.js search with `query`
		let res = settings_fuse ? settings_fuse.search(query) : [];

		// if nothing was found, reset all
		if (res.length == 0) {
			return set_all(true);
		}

		// run through results and unhide all of them
		for (let i = 0; i < res.length; i++) {
			unhide(res[i].item.el);
		}
	}
};

(() => {
	const control=document.getElementById('independentServerModsToggle');
	const status=document.getElementById('independentServerModsStatus');
	if (!control || !status) return;
	let pending=false, result='', before=settings.independentServerMods===true;
	const sync=() => {
		const enabled=pending?before:settings.independentServerMods===true;
		control.classList.toggle('on',enabled); control.classList.toggle('off',!enabled);
		control.setAttribute('aria-checked',String(enabled));
		control.setAttribute('aria-busy',String(pending));
		status.hidden=!pending&&!result;
		status.textContent=pending?I18n.t('settings.independentServerModsPending'):result?I18n.t(result):'';
	};
	control.addEventListener('click',async () => {
		if (control.disabled || Settings.saving || pending) return;
		before=settings.independentServerMods===true; pending=true; result=''; status.classList.remove('is-error'); sync();
		const response=await Settings.savePatch({independentServerMods:settings.independentServerMods!==true});
		pending=false;
		if (!response.ok) {
			result=Settings.modStateError(response.code,'settings.independentServerModsFailed');
			status.classList.add('is-error');
			new Toast({key:'independent-server-mods',scheme:'error',title:I18n.t('settings.independentServerModsFailed'),description:I18n.t(result),timeout:7000});
		} else result='settings.independentServerModsSaved';
		sync();
	});
	for (const name of ['tfx-settings-controls-sync','tfx-settings-persisted','vyra-settings-restored','vyra-language-changed']) window.addEventListener(name,() => { if (['tfx-settings-controls-sync','vyra-settings-restored'].includes(name)) result=''; sync(); });
	ipcRenderer.on('changed-settings',(_event,value) => {if (value && Object.prototype.hasOwnProperty.call(value,'independentServerMods')) sync();});
	sync();
})();

(() => {
	const dialog=document.getElementById('settingsUnsavedDialog'), popup=document.getElementById('options');
	if (!dialog || !popup) return;
	const buttons={save:document.getElementById('settingsUnsavedSave'),discard:document.getElementById('settingsUnsavedDiscard'),stay:document.getElementById('settingsUnsavedStay')};
	let nextAction=null,previousFocus=null;
	const inertStates=new Map();
	function hide(restoreFocus=true) {
		dialog.hidden=true; dialog.setAttribute('aria-hidden','true');
		window.VyraMotion?.cancel(dialog.querySelector('.settings-unsaved-card'));
		for (const [element,inert] of inertStates) element.inert=inert;
		inertStates.clear();
		if (restoreFocus && previousFocus?.isConnected && !previousFocus.closest('[inert]')) previousFocus.focus({preventScroll:true});
	}
	function ask(action) {
		if (!dialog.hidden) return;
		nextAction=action; previousFocus=document.activeElement;
		for (const child of popup.children) if (child!==dialog) {inertStates.set(child,child.inert); child.inert=true;}
		dialog.hidden=false; dialog.setAttribute('aria-hidden','false');
		window.VyraMotion?.reveal(dialog.querySelector('.settings-unsaved-card'),{duration:240,offset:10});
		buttons.stay.focus({preventScroll:true});
	}
	function perform(action) {
		Settings.skipClosePrompt=true;
		try {action?.();} finally {Settings.skipClosePrompt=false;}
	}
	buttons.stay.addEventListener('click',() => {nextAction=null;hide();});
	buttons.discard.addEventListener('click',() => {
		const action=nextAction;nextAction=null;hide(false);perform(action);
	});
	buttons.save.addEventListener('click',async () => {
		const action=nextAction;nextAction=null;hide(false);
		if (await Settings.apply()) perform(action);
		else document.getElementById('apply')?.focus({preventScroll:true});
	});
	document.addEventListener('keydown',event => {
		if (dialog.hidden) return;
		if (event.key==='Escape') {event.preventDefault();event.stopImmediatePropagation();nextAction=null;hide();return;}
		if (event.key!=='Tab') return;
		event.stopImmediatePropagation();
		const controls=Object.values(buttons).filter(button => !button.disabled);
		const first=controls[0],last=controls[controls.length-1];
		if (event.shiftKey && (document.activeElement===first || !dialog.contains(document.activeElement))) {event.preventDefault();last?.focus();}
		else if (!event.shiftKey && (document.activeElement===last || !dialog.contains(document.activeElement))) {event.preventDefault();first?.focus();}
	},true);
	Settings.unsaved=Object.freeze({ask,get shown(){return !dialog.hidden;}});
})();

function get_dns_preset() {
	let select = document.getElementById("dns-preset");
	return select ? select.dataset.value : "aliyun";
}

function set_dns_preset(value) {
	let select = document.getElementById("dns-preset");
	if (! select) {
		return;
	}

	let option = select.querySelector(`.dns-select-menu [data-value="${value}"]`);
	if (! option) {
		return;
	}

	select.dataset.value = value;
	select.querySelector(".dns-select-label").textContent = option.textContent;

	let options = select.querySelectorAll(".dns-select-menu [data-value]");
	for (let item of options) {
		item.setAttribute("aria-selected", item.dataset.value === value ? "true" : "false");
	}
}

function set_dns_select_open(open) {
	let select = document.getElementById("dns-preset");
	if (! select) {
		return;
	}

	let toggle = select.querySelector(".dns-select-toggle");
	let menu = select.querySelector(".dns-select-menu");
	if (! toggle || ! menu) {
		return;
	}

	if (open) {
		select.classList.add("open");
		menu.hidden = false;
		toggle.setAttribute("aria-expanded", "true");
			const selected=menu.querySelector('[aria-selected="true"]')||menu.querySelector('button');
			selected?.focus({preventScroll:true});
	} else {
		select.classList.remove("open");
		menu.hidden = true;
		toggle.setAttribute("aria-expanded", "false");
	}
}

const dnsSelect=document.getElementById('dns-preset');
dnsSelect?.addEventListener('keydown',event=>{
	const options=[...dnsSelect.querySelectorAll('.dns-select-menu button')],opened=dnsSelect.classList.contains('open');
	if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
		event.preventDefault();if(!opened)set_dns_select_open(true);
		const current=options.indexOf(document.activeElement),next=event.key==='Home'?0:event.key==='End'?options.length-1:(current+(event.key==='ArrowDown'?1:-1)+options.length)%options.length;
		options[next]?.focus({preventScroll:true});
	}else if(event.key==='Escape'&&opened){event.preventDefault();event.stopImmediatePropagation();set_dns_select_open(false);dnsSelect.querySelector('.dns-select-toggle').focus({preventScroll:true});}
	else if(event.key==='Tab'&&opened)set_dns_select_open(false);
});

function set_dns_controls_disabled(state) {
	set_dns_select_open(false);

	let controls = document.querySelectorAll(
		"#dns-settings .actions > button, #dns-settings .dns-select-toggle, #dns-settings .dns-select-menu button"
	);
	for (let control of controls) {
		control.disabled = state;
	}
}

async function run_dns_action(channel, success_message, failure_message, ...args) {
	set_dns_controls_disabled(true);

	try {
		let result = await ipcRenderer.invoke(channel, ...args);
		new Toast({
			scheme: result.ok ? "success" : "error",
			title: lang(result.ok ? success_message : failure_message),
			description: ""
		});
	} catch (error) {
		console.error("Unable to complete DNS operation:", error);
		new Toast({
			scheme: "error",
			title: lang(failure_message),
			description: ""
		});
	} finally {
		set_dns_controls_disabled(false);
	}
}

async function set_system_dns() {
	let preset = get_dns_preset();
	let confirmed = confirm(lang("gui.settings.dns.confirm"));
	if (! confirmed) {
		return;
	}

	await run_dns_action(
		"set-system-dns",
		"gui.settings.dns.apply_success",
		"gui.settings.dns.apply_failed",
		preset
	);
}

async function flush_dns_cache() {
	await run_dns_action(
		"flush-dns-cache",
		"gui.settings.dns.flush_success",
		"gui.settings.dns.flush_failed"
	);
}

document.addEventListener("click", (event) => {
	let select = document.getElementById("dns-preset");
	if (! select) {
		return;
	}

	let toggle = event.target.closest(".dns-select-toggle");
	if (toggle && select.contains(toggle)) {
		if (toggle.disabled) {
			return;
		}

		set_dns_select_open(! select.classList.contains("open"));
		return;
	}

	let option = event.target.closest(".dns-select-menu [data-value]");
	if (option && select.contains(option)) {
		if (option.disabled) {
			return;
		}

		set_dns_preset(option.dataset.value);
		set_dns_select_open(false);
		select.querySelector('.dns-select-toggle').focus({preventScroll:true});
		return;
	}

	if (! select.contains(event.target)) {
		set_dns_select_open(false);
	}
});

// search on key events in search input
let search_el = document.body.querySelector("#options .search");
search_el.addEventListener("input", () => {
	Settings.search(search_el.value);
})

// returns a Fuse.js compatible Array for searching through the settings
function get_search_arr() {
	// list of elements that should be taken into consideration when
	// trying to do a search
	let searchables_queries = [
		".settings-section > summary .title",
		".settings-about-author",
		".settings-about-thanks",
		".settings-about-meta",
		".settings-launcher-update",
		".option .text",
		".buttons .text",
		".option .actions input",
		".option .actions select",
		".option .actions .theme-choice",
		".buttons .actions button:not(.switch)",
	]

	let searchables_els = [];

	// run through queries
	for (let i = 0; i < searchables_queries.length; i++) {
		// attempt to get element(s) with that query
		let query = document.querySelectorAll(
			".options " + searchables_queries[i]
		)

		// if something was found add it
		searchables_els = [
			...query,
			...searchables_els
		]
	}

	let searchables = [];

	// run through the found elements
	for (let i = 0; i < searchables_els.length; i++) {
		let el = searchables_els[i];
		switch(el.tagName.toLowerCase()) {
			// is this an `<input>`?
			case "input":
				// if no value is in the input, do nothing
				if (! el.value) {
					continue;
				}

				// add to list of searchable elements, using the value
				// of the input as the text
				searchables.push({
					el: el,
					text: el.value
				})
				break;

			// is this a `<select>`?
			case "select":
				// get options in `<select>`
				let options = el.children;

				// run through options
				for (let ii = 0; ii < options.length; ii++) {
					// add to list of searchable elements, using the
					// insides of the option as the text, and the
					// element being the `<select>` and not the
					// `<option>`!
					searchables.push({
						el: el,
						text: options[ii].textContent
					})
				}
				break;

			default:
				// add to list of searchable elements using the insides
				// of the element as the text
				searchables.push({
					el: el,
					text: el.textContent
				})
		}
	}

	// return the actual searchable elements and text
	return searchables;
}

events.on("popup-changed", () => {
	let settings_is_shown =
		document.getElementById("options")
		.classList.contains("shown");

	let settings_btn = document.getElementById("settings");

	if (settings_is_shown) {
		settings_btn.classList.add("shown");
	} else {
		settings_btn.classList.remove("shown");
		Settings.cancel();
	}
})

document.body.addEventListener("click", (e) => {
	const control = e.target.closest?.("#options .option .actions button.switch");
	if (control && !control.disabled) Settings.switch(control);
})

Settings.load();
window.addEventListener('vyra-language-changed', () => {
	settings_fuse = new Fuse(get_search_arr(), {keys:['text'], threshold:0.4, ignoreLocation:true});
	Settings.search(search_el.value);
	set_dns_preset(get_dns_preset());
});
