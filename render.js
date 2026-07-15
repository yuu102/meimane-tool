import { calculateDailyExpGain, getPercentage } from "./utils.js";
import { seriesClass } from "./jobs.js";

function control(className, label, title, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  button.title = title;
  button.addEventListener("click", (event) => { event.stopPropagation(); onClick(); });
  return button;
}

export function filteredAndSorted(characters, keyword, sortMode, viewMode = "all") {
  const search = keyword.trim().toLocaleLowerCase("ja-JP");
  const visible = characters
    .filter((character) => viewMode === "all" || (viewMode === "completed" ? character.completed : !character.completed))
    .filter((character) => `${character.name} ${character.job}`.toLocaleLowerCase("ja-JP").includes(search));
  if (sortMode === "favorite") return [...visible].sort((a, b) => Number(b.favorite) - Number(a.favorite));
  if (sortMode === "level") return [...visible].sort((a, b) => Number(b.level) - Number(a.level));
  if (sortMode === "name") return [...visible].sort((a, b) => a.name.localeCompare(b.name, "ja"));
  return [...visible].sort((a, b) => a.order - b.order);
}

export function render({ list, counts, characters, keyword, sortMode, viewMode, onOpenDetail, onToggleFavorite, onChangeViewMode }) {
  const visible = filteredAndSorted(characters, keyword, sortMode, viewMode);
  list.replaceChildren();
  if (!visible.length) {
    const empty = document.createElement("p");
    empty.className = "empty-message";
    empty.textContent = characters.length ? "該当するキャラクターがいません" : "キャラクターがいません";
    list.append(empty);
  }
  visible.forEach((character) => list.append(renderCard(character, onOpenDetail, onToggleFavorite)));
  renderSummary(counts, characters, viewMode, onChangeViewMode);
}

export function renderSummary(counts, characters, viewMode, onChangeViewMode) {
  const completed = characters.filter((character) => character.completed).length;
  const data = [
    ["all", characters.length],
    ["completed", completed],
    ["remaining", characters.length - completed],
  ];
  data.forEach(([mode, count]) => {
    const button = counts[mode];
    button.querySelector("span:last-child").textContent = String(count);
    const selected = viewMode === mode;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
    button.onclick = () => onChangeViewMode(mode);
  });
}

function percentageText(value) {
  return `${getPercentage(value).toFixed(2)}%`;
}

function gainText(gain) {
  if (gain === 0) return "±0.00%";
  return `${gain > 0 ? "+" : ""}${gain.toFixed(2)}%`;
}

export function renderCard(character, onOpenDetail, onToggleFavorite) {
  const card = document.createElement("div");
  card.className = "character-card";
  card.classList.toggle("is-completed", character.completed);
  card.classList.toggle("is-favorite", character.favorite);
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `${character.name}の詳細を開く`);
  const header = document.createElement("div");
  header.className = "card-header";
  const status = document.createElement("span");
  status.className = "completion-status";
  status.textContent = character.completed ? "✓ 完了" : "○ 未完了";
  header.append(control("favorite-toggle", character.favorite ? "★" : "☆", "お気に入り", () => onToggleFavorite(character.id)), status);
  const nameRow = document.createElement("div");
  nameRow.className = "character-name-row";
  const name = document.createElement("div");
  name.className = "character-name";
  name.textContent = character.name;
  nameRow.append(name);
  const levelRow = document.createElement("div");
  levelRow.className = "character-level-row";
  if (character.job) {
    const job = document.createElement("span");
    job.className = `job-badge ${seriesClass(character.series)}`;
    job.textContent = character.job;
    levelRow.append(job);
  }
  const level = document.createElement("div");
  level.className = "character-level";
  level.textContent = `Lv.${character.level}`;
  levelRow.prepend(level);
  card.append(header, nameRow, levelRow, renderExpSection(character));
  card.addEventListener("click", () => onOpenDetail(character.id));
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpenDetail(character.id);
    }
  });
  return card;
}

export function renderExpSection(character) {
  const previous = getPercentage(character.previousExp);
  const afterExists = character.afterDailyExp !== "" && character.afterDailyExp !== null && character.afterDailyExp !== undefined;
  const displayed = afterExists ? getPercentage(character.afterDailyExp) : previous;
  const section = document.createElement("div");
  section.className = "exp-section";
  const meta = document.createElement("div");
  meta.className = "exp-meta";
  meta.innerHTML = `<span>前日 ${percentageText(character.previousExp)}</span>${afterExists ? `<span>日課後 ${percentageText(character.afterDailyExp)}</span>` : ""}`;
  const bar = document.createElement("div");
  bar.className = "exp-bar";
  bar.setAttribute("role", "progressbar");
  bar.setAttribute("aria-valuemin", "0");
  bar.setAttribute("aria-valuemax", "100");
  bar.setAttribute("aria-valuenow", String(displayed));
  const fill = document.createElement("div");
  fill.className = "exp-fill";
  fill.style.width = `${displayed}%`;
  bar.append(fill);
  section.append(meta, bar);
  if (afterExists) {
    const gain = calculateDailyExpGain(character);
    if (gain !== null) {
      const gainElement = document.createElement("div");
      gainElement.className = `daily-exp-gain ${gain < 0 ? "is-negative" : ""}`;
      gainElement.textContent = `本日の獲得 ${gainText(gain)}`;
      section.append(gainElement);
    }
  } else {
    const next = document.createElement("div");
    next.className = "next-level";
    next.textContent = `次のレベルまで ${(100 - previous).toFixed(2)}%`;
    section.append(next);
  }
  return section;
}
