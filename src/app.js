import { createI18n } from "./i18n.js";
import { loadState, saveState, createEmptyState } from "./storage.js";
import { generateSchedule } from "./mixer.js";

const app = document.querySelector("#app");
const i18n = createI18n();
let state = loadState();
let activeCourtId = state.courts[0]?.id || "";
let expandedScheduleId = null;

const persist = () => saveState(state);
const t = (key, variables) => i18n.t(key, variables);
const el = (tag, attrs = {}, children = []) => {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else node.setAttribute(key, value);
  });
  children.forEach(child => node.append(child));
  return node;
};
const button = (text, className, handler, attrs = {}) => {
  const node = el("button", { class: className, type: "button", text, ...attrs });
  node.addEventListener("click", handler);
  return node;
};
const courtName = court => t("court.label", { number: court.id.replace(/^c/, "") });

function shell(title, subtitle) {
  const root = el("div", { class: "app-shell" });
  const nextLanguage = i18n.getLanguage() === "id" ? "en" : "id";
  const languageButton = button(i18n.getLanguage().toUpperCase(), "icon-btn", () => {
    i18n.setLanguage(nextLanguage);
    render();
  }, { "aria-label": t("language.switch") });
  const heading = el("div", {}, [
    el("div", { class: "eyebrow", text: "PadelScore" }),
    el("h1", { class: "title", text: title }),
    el("div", { class: "subtle", text: subtitle })
  ]);
  root.append(el("header", { class: "topbar" }, [heading, languageButton]));
  return root;
}

function showError(node, message) {
  node.textContent = message;
  node.hidden = false;
}

function render() {
  app.replaceChildren();
  if (state.session.status === "empty") renderEmpty();
  else if (state.session.status === "setup") renderSetup();
  else if (state.session.status === "players") renderPlayers();
  else renderSchedule();
}

function renderEmpty() {
  const root = shell(t("empty.title"), t("empty.subtitle"));
  const content = el("section", { class: "empty" });
  const box = el("div");
  box.append(
    el("div", { class: "empty-mark", text: "⌁" }),
    el("h2", { text: t("empty.heading") }),
    el("p", { text: t("empty.description") }),
    button(t("empty.create"), "primary-btn", () => {
      state.session.status = "setup";
      persist();
      render();
    })
  );
  content.append(box);
  root.append(content);
  app.append(root);
}

function cancelDraft() {
  state = createEmptyState();
  persist();
  render();
}

function renderSetup() {
  const root = shell(t("setup.title"), t("setup.subtitle"));
  root.append(el("div", { class: "steps" }, [el("i", { class: "active" }), el("i"), el("i")]));
  const panel = el("form", { class: "panel" });
  const error = el("div", { class: "error" });
  error.hidden = true;
  const fields = {};
  [
    ["playerCount", "setup.players", "setup.examplePlayers", 4],
    ["courtCount", "setup.courts", "setup.exampleCourts", 1],
    ["durationHours", "setup.duration", "setup.exampleDuration", 0.1]
  ].forEach(([key, labelKey, placeholderKey, min]) => {
    const wrap = el("div", { class: "field" });
    wrap.append(el("label", { for: key, text: t(labelKey) }));
    const input = el("input", { class: "input", id: key, type: "number", min, step: key === "durationHours" ? "0.1" : "1", placeholder: t(placeholderKey) });
    fields[key] = input;
    wrap.append(input);
    if (key === "durationHours") wrap.append(el("div", { class: "subtle", text: t("setup.rotation") }));
    panel.append(wrap);
  });
  const actions = el("div", { class: "form-actions" }, [
    button(t("setup.create"), "primary-btn wide", event => {
      event.preventDefault();
      const players = Number(fields.playerCount.value);
      const courts = Number(fields.courtCount.value);
      const duration = Number(fields.durationHours.value);
      if (!Number.isInteger(players) || players < 4 || !Number.isInteger(courts) || courts < 1 || duration <= 0) return showError(error, t("validation.setup"));
      state.session = { status: "players", playerCount: players, courtCount: courts, durationHours: duration, slotMinutes: 10 };
      state.players = Array.from({ length: players }, (_, index) => ({ id: `p${index + 1}`, name: "", matches: 0, wins: 0, byes: 0 }));
      state.courts = Array.from({ length: courts }, (_, index) => ({ id: `c${index + 1}`, name: `Court ${index + 1}` }));
      state.schedule = [];
      persist();
      render();
    }),
    button(t("common.cancel"), "secondary-btn wide", cancelDraft)
  ]);
  panel.append(error, actions);
  root.append(panel);
  app.append(root);
}

function renderPlayers() {
  const root = shell(t("players.title"), t("players.subtitle", { count: state.session.playerCount }));
  root.append(el("div", { class: "steps" }, [el("i", { class: "active" }), el("i", { class: "active" }), el("i")]));
  const panel = el("form", { class: "panel" });
  const list = el("div", { class: "name-list" });
  const inputs = [];
  state.players.forEach((player, index) => {
    const row = el("div", { class: "name-row" });
    row.append(el("span", { class: "name-number", text: String(index + 1).padStart(2, "0") }));
    const input = el("input", { class: "input", type: "text", placeholder: t("players.placeholder", { number: index + 1 }), value: player.name, autocomplete: "off" });
    input.addEventListener("input", () => { player.name = input.value; });
    inputs.push(input);
    row.append(input);
    list.append(row);
  });
  const error = el("div", { class: "error" });
  error.hidden = true;
  const actions = el("div", { class: "form-actions" }, [
    button(t("players.create"), "primary-btn wide", event => {
      event.preventDefault();
      const names = inputs.map(input => input.value.trim());
      const normalized = names.map(name => name.toLocaleLowerCase());
      if (names.some(name => !name)) return showError(error, t("validation.namesRequired"));
      if (new Set(normalized).size !== names.length) return showError(error, t("validation.namesDuplicate"));
      state.players.forEach((player, index) => { player.name = names[index]; });
      state.schedule = generateSchedule({ players: state.players, courts: state.courts, durationHours: state.session.durationHours }).schedule;
      state.session.status = "schedule";
      activeCourtId = state.courts[0].id;
      persist();
      render();
    }),
    button(t("common.cancel"), "secondary-btn wide", cancelDraft)
  ]);
  panel.append(
    el("div", { class: "section-head" }, [el("h2", { text: t("players.heading") }), el("span", { class: "subtle", text: t("players.count", { count: state.players.length }) })]),
    list,
    error,
    actions
  );
  root.append(panel);
  app.append(root);
}

function renderSchedule() {
  const root = shell(t("schedule.title"), t("schedule.subtitle", { hours: state.session.durationHours }));
  const tabs = el("nav", { class: "court-tabs", "aria-label": t("schedule.chooseCourt") });
  state.courts.forEach(court => tabs.append(button(courtName(court), `court-tab ${court.id === activeCourtId ? "active" : ""}`, () => {
    activeCourtId = court.id;
    expandedScheduleId = null;
    render();
  })));
  root.append(tabs);
  const list = el("section");
  const court = state.courts.find(item => item.id === activeCourtId) || state.courts[0];
  const items = state.schedule.filter(item => item.courtId === court.id);
  const activeItem = items.find(item => item.started && !item.finished);
  const nextItem = items.find(item => !item.finished && !item.started);
  if (!expandedScheduleId || !items.some(item => item.id === expandedScheduleId)) expandedScheduleId = activeItem?.id || nextItem?.id;
  list.append(el("div", { class: "section-head" }, [el("h2", { text: courtName(court) }), el("span", { class: "subtle", text: t("schedule.matches", { count: items.length }) })]));
  items.forEach(item => list.append(scheduleCard(item, item.id === expandedScheduleId, !activeItem && item.id === nextItem?.id)));
  const bye = items[0]?.bye || [];
  if (bye.length) list.append(el("div", { class: "bye", text: t("schedule.bye", { names: bye.map(id => state.players.find(player => player.id === id)?.name).join(" · ") }) }));
  root.append(list);
  const actions = el("div", { class: "footer-actions" });
  actions.append(el("span", { class: "subtle", text: t("schedule.saved") }), button(t("schedule.reset"), "danger", () => {
    if (window.confirm(t("schedule.resetConfirm"))) {
      state = createEmptyState();
      persist();
      render();
    }
  }));
  root.append(actions);
  app.append(root);
}

function scheduleCard(item, expanded, canStart) {
  const names = id => state.players.find(player => player.id === id)?.name || "-";
  const active = item.started && !item.finished;
  const card = el("article", { class: `schedule-item ${item.finished ? "done" : active ? "live" : ""} ${expanded && active ? "expanded" : "collapsed"}` });
  const status = item.finished ? t("status.finished") : active ? t("status.playing") : "";
  if (status) card.append(el("div", { class: "slot-head status-row" }, [el("span", { class: "live-text", text: status })]));
  const match = el("div", { class: "match" });
  match.append(el("div", { class: "team", text: `${names(item.teamA[0])}\n${names(item.teamA[1])}` }));
  if (!active) {
    match.append(el("div", { class: "collapsed-score", text: item.scoreA || item.scoreB ? `${item.scoreA || 0} — ${item.scoreB || 0}` : "—" }), el("div", { class: "team right", text: `${names(item.teamB[0])}\n${names(item.teamB[1])}` }));
    card.append(match);
    if (item.finished) card.append(button(t("match.edit"), "more-btn", () => {
      item.finished = false;
      item.started = true;
      expandedScheduleId = item.id;
      persist();
      render();
    }));
    else if (canStart) card.append(button(t("match.start"), "more-btn start-btn", () => {
      item.started = true;
      expandedScheduleId = item.id;
      persist();
      render();
    }));
    return card;
  }
  const scores = el("div", { class: "scores" });
  scores.append(el("div", { class: "score-label", text: t("score.label") }));
  ["scoreA", "scoreB"].forEach(key => {
    const input = el("input", { type: "number", min: 0, inputmode: "numeric", value: item[key], "aria-label": t(key === "scoreA" ? "score.left" : "score.right") });
    input.addEventListener("input", () => {
      item[key] = input.value;
      persist();
    });
    scores.append(input);
  });
  match.append(scores, el("div", { class: "team right", text: `${names(item.teamB[0])}\n${names(item.teamB[1])}` }));
  card.append(match, button(t("match.finish"), "finish-btn", () => {
    item.finished = true;
    persist();
    render();
  }));
  return card;
}

render();
