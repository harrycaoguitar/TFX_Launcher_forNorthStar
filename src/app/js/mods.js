/* TFX installed-mod view: keyed cards, observed saves and package-wide actions. */
var mods;
(() => {
  "use strict";
  const container = document.getElementById("modsdiv");
  const input = document.getElementById("modSearch");
  const sortSelect = document.getElementById("modSort");
  const cards = new Map();
  const pending = new Map();
  const feedback = new Map();
  let snapshot = {all:[]};
  let groups = new Map();
  let sequence = 0;
  let writes = Promise.resolve();
  let available = true;
  let searchState = {query:"", matched:0, total:0};
  const normalized = value => String(value ?? "").normalize("NFKC").toLocaleLowerCase();
  const copy = key => I18n.t("mods." + key);
  const mode = value => ["added", "name", "enabled"].includes(value) ? value : "added";
  const context = () => JSON.stringify([settings.gamepath || '', settings.globalGamepath || '', settings.modProfileServer || settings.northstarRegion || 'cn', settings.independentServerMods === true]);
  const settingsBusy = () => Boolean(window.Settings?.saving);
  const encode = value => encodeURIComponent(String(value ?? "")).replace(/_/g, "%5F").replace(/%/g, "_");
  const label = mod => mod.package?.manifest?.name || mod.package?.package_name || mod.manifest_name || mod.name;
  const key = mod => mod.package ? "package-" + encode([mod.package.author, mod.package.package_name, mod.package.version || mod.package.manifest?.version_number || ""].join("/")) : "local-" + encode(mod.name);

  function node(tag, className, text) {
    const result = document.createElement(tag);
    if (className) result.className = className;
    if (text !== undefined) result.textContent = String(text);
    return result;
  }

  function collect(items) {
    const found = new Map();
    for (const record of items) {
      if (!record || typeof record.name !== "string") continue;
      const id = key(record);
      let group = found.get(id);
      if (!group) {group = {...record, records:[], search:"", disabled:true, required:false, stateControl:false, addedAt:0}; found.set(id, group);}
      group.records.push(record);
      group.disabled = group.disabled && Boolean(record.disabled);
      group.required = group.required || Boolean(record.required);
      group.stateControl = group.stateControl || record.stateControl !== false;
      const addedAt = Number(record.addedAt) || 0;
      if (!group.addedAt || addedAt && addedAt < group.addedAt) group.addedAt = addedAt;
      group.search += " " + normalized([record.name, record.manifest_name, record.author, record.description, record.package?.package_name, record.package?.manifest?.name, record.package?.manifest?.author, record.package?.manifest?.description].filter(Boolean).join(" "));
    }
    return found;
  }

  function ordering(items, value) {
    const compare = new Intl.Collator(I18n.current, {numeric:true, sensitivity:"base"}).compare;
    const byName = (a, b) => compare(String(label(a)), String(label(b))) || compare(key(a), key(b));
    return [...collect(items).values()].sort((a, b) => value === "name" ? byName(a, b)
      : value === "enabled" ? Number(a.disabled) - Number(b.disabled) || byName(a, b)
      : b.addedAt - a.addedAt || byName(a, b));
  }

  function current(id) {return groups.get(id);}
  function names(mod) {return [...new Set((current(key(mod))?.records || mod.records || [mod]).map(record => record.name))];}
  function protectedMod(mod) {return Boolean(current(key(mod))?.required || mod.required);}

  function preservePosition(action) {
    const scroller = document.getElementById("nsContent");
    const position = scroller?.scrollTop || 0;
    const focused = container.contains(document.activeElement) ? document.activeElement : null;
    action();
    if (focused?.isConnected && document.activeElement !== focused) focused.focus({preventScroll:true});
    if (scroller) scroller.scrollTop = position;
  }

  function viewState(id) {
    const group = current(id), card = cards.get(id);
    if (!group || !card) return;
    const queued = pending.get(id), saved = feedback.get(id), saving = queued?.context === context() ? queued : null, message = saved?.context === context() ? saved : null;
    const enabled = saving ? saving.enabled : !group.disabled;
    const required = group.required;
    const controllable = group.stateControl;
    const toggle = card.querySelector(".switch");
    const status = card.querySelector(".mod-state-label");
    const flags = {"mod-is-disabled":!enabled, "mod-is-pending":Boolean(saving), "mod-is-saving":Boolean(saving?.visible), "mod-save-confirmed":Boolean(!saving && message?.type === "saved"), "mod-save-error":Boolean(!saving && message?.type === "error")};
    for (const [className, active] of Object.entries(flags)) card.classList.toggle(className, active);
    toggle.classList.toggle("on", enabled);
    toggle.disabled = required || !available || !controllable || settingsBusy();
    toggle.hidden = !controllable;
    toggle.setAttribute("aria-checked", String(enabled));
    toggle.setAttribute("aria-busy", String(Boolean(saving)));
    toggle.setAttribute("aria-disabled", String(required || !available || !controllable || Boolean(saving) || settingsBusy()));
    toggle.setAttribute("aria-label", copy(required ? "coreComponent" : enabled ? "disableLabel" : "enableLabel") + " " + label(group));
    toggle.title = required ? copy("coreHint") : "";
    const state = required ? "coreComponent" : saving?.slow ? "waiting" : saving?.visible ? enabled ? "enabling" : "disabling" : !saving && message?.type === "error" ? "saveFailed" : enabled ? "enabled" : "disabled";
    status.textContent = controllable ? copy(state) : I18n.text("插件");
    status.title = message?.error || "";
    for (const button of card.querySelectorAll(".remove,.update")) {button.disabled = !available || required || settingsBusy(); button.setAttribute("aria-disabled", String(required || !available || Boolean(saving) || settingsBusy()));}
    const remove = card.querySelector(".remove");
    remove.disabled = required || !available || settingsBusy();
    remove.title = required ? copy("coreHint") : "";
  }

  function clearFeedback(id) {
    const saved = feedback.get(id);
    if (saved?.timer) clearTimeout(saved.timer);
    feedback.delete(id);
  }

  function applySearch() {
    const query = input?.value.trim() || "";
    const terms = normalized(query).split(/\s+/u).filter(Boolean);
    let matched = 0;
    preservePosition(() => {
      for (const [id, card] of cards) {
        const visible = terms.every(term => (current(id)?.search || "").includes(term));
        card.hidden = !visible;
        if (visible) matched++;
      }
      searchState = {query, matched, total:cards.size};
      const count = document.getElementById("modcount");
      if (count) count.textContent = I18n.t(query ? "mods.searchCount" : "mods.totalCount", {matched, total:cards.size});
      const clear = document.getElementById("modSearchClear");
      if (clear) clear.hidden = !input?.value;
      const empty = document.getElementById("modSearchEmpty");
      if (empty) {
        empty.hidden = matched > 0;
        empty.querySelector("h4").textContent = copy(query ? "searchEmpty" : "libraryEmpty");
        empty.querySelector("p").textContent = copy(query ? "searchHint" : "libraryHint");
        const action = empty.querySelector("button");
        action.hidden = !query;
        action.textContent = copy("searchClear");
      }
    });
  }

  function clearSearch() {if (input) {input.value = ""; applySearch(); input.focus({preventScroll:true});}}

  function cardFor(id) {
    const card = node("div", "el");
    card.id = "mod-list-" + id;
    const image = node("div", "image");
    for (const className of ["", "blur"]) {const artwork = node("img", className); artwork.alt = ""; image.append(artwork);}
    const text = node("div", "text");
    const title = node("div", "title"), description = node("div", "description");
    const toggleControl = node("div", "mod-toggle-control");
    const toggle = node("button", "switch on orange"); toggle.type = "button"; toggle.setAttribute("role", "switch");
    toggle.addEventListener("click", () => {const group = current(id); if (group) toggleGroup(group);});
    const state = node("span", "mod-state-label"); state.setAttribute("aria-live", "polite"); state.setAttribute("aria-atomic", "true");
    toggleControl.append(toggle, state);
    text.append(title, description, toggleControl);
    for (const [className, icon] of [["update bg-blue", "downloads"], ["bg-red remove", "trash"]]) {
      const button = node("button", className); button.type = "button";
      const mark = node("img"); mark.src = "icons/" + icon + ".png"; mark.alt = "";
      button.append(mark, node("span")); text.append(button);
    }
    text.append(node("button", "visual version"), node("button", "visual author"));
    for (const dynamic of [title, description, state]) dynamic.dataset.i18nIgnore = "";
    card.append(image, text);
    card.querySelectorAll(".visual").forEach(button => button.type = "button");
    card.querySelector(".remove").addEventListener("click", () => {const group = current(id); if (group && !pending.has(id)) remove(group.name, group.package);});
    card.querySelector(".update").addEventListener("click", () => {const group = current(id); if (group && !pending.has(id) && !group.required) window.Browser?.lookup(group)?.install();});
    return card;
  }

  function decorate(id, group) {
    const card = cards.get(id);
    const manifest = group.package?.manifest;
    const info = window.Browser?.lookup(group);
    const text = label(group);
    card.querySelector(".title").textContent = text;
    card.querySelector(".title").title = text;
    card.querySelector(".description").textContent = manifest?.description || group.description || "";
    card.querySelector(".description").title = card.querySelector(".description").textContent;
    card.querySelector(".version").textContent = version.format(manifest?.version_number || group.version);
    card.querySelector(".author").textContent = lang("gui.browser.made_by") + " " + (group.author || group.package?.author || lang("gui.mods.unknown_author"));
    card.querySelector(".update span").textContent = lang("gui.browser.update");
    card.querySelector(".remove span").textContent = lang("gui.mods.remove");
    card.querySelector(".update").style.display = info?.has_update ? "" : "none";
    const remoteImage = info?.package?.versions?.[0]?.icon;
    const image = group.package?.icon || remoteImage || (/^Northstar\./i.test(group.name) ? "icons/northstar.png" : "");
    for (const artwork of card.querySelectorAll(".image img")) {
      if (image) {if (artwork.getAttribute("src") !== image) artwork.src = image;}
      else artwork.removeAttribute("src");
    }
    card.querySelector(".image").style.display = image ? "" : "none";
    card.classList.toggle("has-icon", Boolean(image));
    viewState(id);
  }

  function load(value) {
    snapshot = value && Array.isArray(value.all) ? value : {all:[]};
    groups = collect(snapshot.all);
    preservePosition(() => {
      sortSelect.value = mode(settings.modSort);
      window.ModSort?.sync();
      let ordered = ordering(snapshot.all, mode(settings.modSort));
      if (pending.size && mode(settings.modSort) === "enabled") {
        const positions = new Map([...container.querySelectorAll(".el")].map((card, index) => [card.id, index]));
        ordered.sort((a, b) => (positions.get("mod-list-" + key(a)) ?? Infinity) - (positions.get("mod-list-" + key(b)) ?? Infinity));
      }
      for (const [id, card] of cards) if (!groups.has(id)) {card.remove(); cards.delete(id); clearFeedback(id);}
      let anchor = container.querySelector(".el");
      for (const group of ordered) {
        const id = key(group);
        if (!cards.has(id)) cards.set(id, cardFor(id));
        const card = cards.get(id);
        if (card !== anchor) container.insertBefore(card, anchor);
        anchor = card.nextElementSibling;
        decorate(id, group);
      }
      applySearch();
    });
  }

  function invokeState(request) {
    const operation = writes.then(() => ipcRenderer.invoke("set-mod-state", request));
    writes = operation.catch(() => undefined);
    return operation;
  }

  async function save(requests, states) {
    if (settingsBusy() || !states.length || states.some(item => pending.has(item.key))) return false;
    const token = ++sequence, started = Date.now(), requestContext=context();
    const touched = states.map(item => ({...item, token, context:requestContext, visible:false, slow:false}));
    for (const item of touched) {clearFeedback(item.key); pending.set(item.key, item); viewState(item.key);}
    const timers = [setTimeout(() => {for (const item of touched) {item.visible = true; viewState(item.key);}}, 140), setTimeout(() => {for (const item of touched) {item.slow = true; viewState(item.key);}}, 8000)];
    document.getElementById("toggleall")?.setAttribute("aria-disabled", "true");
    let failure = "", stale=false;
    try {
      for (const request of requests) {
        const response = await invokeState(request);
        if (requestContext !== context()) {stale=true; break;}
        if (Array.isArray(response?.mods?.all)) load(response.mods);
        if (!response?.ok) throw new Error(response?.error || copy("saveFailed"));
        for (const selection of request.selections || [request]) {
          for (const name of selection.names) {
            const observed = snapshot.all.find(record => record.name === name && (!selection.package || key(record) === key({package:selection.package})));
            if (!observed || !observed.disabled !== selection.enabled) throw new Error(copy("saveFailed"));
          }
        }
      }
      clearTimeout(timers[0]);
      const remaining = 380 - (Date.now() - started);
      if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining));
    } catch (error) {failure = I18n.text(error?.message || copy("saveFailed"));}
    finally {
      timers.forEach(clearTimeout);
      for (const item of touched) {
        if (pending.get(item.key)?.token !== token) continue;
        pending.delete(item.key);
        if (stale || requestContext !== context()) {clearFeedback(item.key); continue;}
        const message = {type:failure ? "error" : "saved", error:failure, context:requestContext};
        feedback.set(item.key, message);
        if (!failure) message.timer = setTimeout(() => {if (feedback.get(item.key) === message) {feedback.delete(item.key); viewState(item.key);}}, 950);
      }
      load(snapshot);
      document.getElementById("toggleall")?.setAttribute("aria-disabled", String(pending.size > 0));
    }
    return !failure && !stale;
  }

  function toggleGroup(group) {
    const id = key(group);
    if (settingsBusy() || !available || group.stateControl === false || pending.has(id) || protectedMod(group)) return false;
    const enabled = Boolean(group.disabled);
    const packageInfo = group.package ? {author:group.package.author, package_name:group.package.package_name, version:group.package.version || group.package.manifest?.version_number} : null;
    return save([{names:names(group), enabled, ...(packageInfo ? {package:packageInfo} : {})}], [{key:id, enabled}]);
  }

  function toggle(name) {
    if (name !== "allmods") {const record = snapshot.all.find(mod => mod.name === name); return record ? toggleGroup(current(key(record))) : false;}
    if (settingsBusy() || !available || pending.size || !confirm(I18n.t("mods.confirmToggleAll"))) return false;
    const candidates = [...groups.values()].filter(group => !group.required && group.stateControl);
    const requests = candidates.map(group => ({enabled:Boolean(group.disabled), names:names(group), ...(group.package ? {package:{author:group.package.author, package_name:group.package.package_name, version:group.package.version || group.package.manifest?.version_number}} : {})}));
    return save([{selections:requests}], candidates.map(group => ({key:key(group), enabled:Boolean(group.disabled)})));
  }

  function remove(name, packageInfo) {
    if (settingsBusy() || !available) return false;
    if (name === "allmods") {
      if (pending.size || !confirm(I18n.t("mods.confirmRemoveAll"))) return false;
    } else {
      const record = snapshot.all.find(mod => mod.name === name && (!packageInfo || key(mod) === key({package:packageInfo})));
      if (!record || protectedMod(record) || pending.has(key(record))) return false;
      if (/^northstar\./i.test(name) && !confirm(lang("gui.mods.required_confirm"))) return false;
    }
    const payload = packageInfo ? {name, package:{author:packageInfo.author, package_name:packageInfo.package_name, version:packageInfo.version || packageInfo.manifest?.version_number}} : name;
    ipcRenderer.send("remove-mod", payload);
    return true;
  }

  mods = {
    load, toggle, remove, key, displayName:label, children:names, required:protectedMod, pending, feedback,
    sorted:(items, value = mode(settings.modSort)) => ordering(items, value),
    sortMode:mode,
    setSort(value) {settings.modSort = mode(value); ipcRenderer.send("save-settings", {modSort:settings.modSort}); load(snapshot);},
    applySearch, clearSearch, searchText:normalized,
    stateFor:current, renderState:viewState, redrawState:viewState, toggleCard:toggleGroup, requestState:save,
    get latest() {return snapshot;},
    get searchState() {return searchState;},
    setAvailability(value) {available = Boolean(value); for (const id of cards.keys()) viewState(id);}
  };
  input?.addEventListener("input", applySearch);
  input?.addEventListener("keydown", event => {if (event.key === "Escape" && input.value) {event.preventDefault(); event.stopPropagation(); clearSearch();}});
  document.getElementById("modSearchClear")?.addEventListener("click", clearSearch);
  document.getElementById("modSearchEmptyClear")?.addEventListener("click", clearSearch);
  window.addEventListener("vyra-language-changed", () => load(snapshot));
  window.addEventListener("tfx-settings-saving-changed", () => {for (const id of cards.keys()) viewState(id);});
  ipcRenderer.on("changed-settings", (_event, update) => {
    if (!update) return;
    if (Object.hasOwn(update, "modSort")) {settings.modSort = mode(update.modSort); load(snapshot);}
    if (["gamepath", "globalGamepath", "modProfileServer", "northstarRegion", "independentServerMods"].some(key => Object.hasOwn(update, key))) ipcRenderer.send("gui-getmods");
  });
})();
