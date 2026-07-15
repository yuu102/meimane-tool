import { getPercentage } from "./utils.js";
import { seriesClass } from "./jobs.js";

function control(className, label, title, onClick) { const button = document.createElement("button"); button.type = "button"; button.className = className; button.textContent = label; button.title = title; button.addEventListener("click", (event) => { event.stopPropagation(); onClick(); }); return button; }

export function filteredAndSorted(characters, keyword, sortMode, hideCompleted = false) {
  const visible = characters.filter((character) => !hideCompleted || !character.completed).filter((character) => `${character.name} ${character.job}`.toLocaleLowerCase("ja-JP").includes(keyword.trim().toLocaleLowerCase("ja-JP")));
  if (sortMode === "favorite") return [...visible].sort((a, b) => Number(b.favorite) - Number(a.favorite));
  if (sortMode === "level") return [...visible].sort((a, b) => Number(b.level) - Number(a.level));
  if (sortMode === "name") return [...visible].sort((a, b) => a.name.localeCompare(b.name, "ja"));
  return visible;
}

export function render({ list, counts, characters, keyword, sortMode, hideCompleted, onOpenDetail, onToggleFavorite }) {
  const visible = filteredAndSorted(characters, keyword, sortMode, hideCompleted); list.replaceChildren();
  if (!visible.length) { const empty = document.createElement("p"); empty.className = "empty-message"; empty.textContent = characters.length ? "該当するキャラクターがいません" : "キャラクターがいません"; list.append(empty); }
  visible.forEach((character) => list.append(renderCard(character, onOpenDetail, onToggleFavorite)));
  const completed = characters.filter((character) => character.completed).length;
  counts.total.textContent = String(characters.length); counts.completed.textContent = String(completed); counts.remain.textContent = String(characters.length - completed);
}

function renderCard(character, onOpenDetail, onToggleFavorite) {
  const card = document.createElement("div"); card.className = "character-card"; card.classList.toggle("is-completed", character.completed); card.classList.toggle("is-favorite", character.favorite); card.tabIndex = 0; card.setAttribute("role", "button"); card.setAttribute("aria-label", `${character.name}の詳細を開く`);
  const header = document.createElement("div"); header.className = "card-header";
  const status = document.createElement("span"); status.className = "completion-status"; status.textContent = character.completed ? "✓ 完了" : "○ 未完了";
  header.append(control("favorite-toggle", character.favorite ? "★" : "☆", "お気に入り", () => onToggleFavorite(character.id)), status);
  const nameRow = document.createElement("div"); nameRow.className = "character-name-row";
  const name = document.createElement("div"); name.className = "character-name"; name.textContent = character.name; nameRow.append(name);
  if (character.job) { const job = document.createElement("span"); job.className = `job-badge ${seriesClass(character.series)}`; job.textContent = character.job; nameRow.append(job); }
  const level = document.createElement("div"); level.className = "character-level"; level.textContent = `Lv.${character.level}`;
  const percent = getPercentage(character.previousExp); const exp = document.createElement("div"); exp.className = "exp-section";
  const meta = document.createElement("div"); meta.className = "exp-meta"; meta.innerHTML = `<span>EXP ${percent.toFixed(2)}%</span><span class="exp-percent">前日終了時</span>`;
  const bar = document.createElement("div"); bar.className = "exp-bar"; bar.setAttribute("role", "progressbar"); bar.setAttribute("aria-valuemin", "0"); bar.setAttribute("aria-valuemax", "100"); bar.setAttribute("aria-valuenow", String(percent));
  const fill = document.createElement("div"); fill.className = "exp-fill"; fill.style.width = `${percent}%`; bar.append(fill);
  const next = document.createElement("div"); next.className = "next-level"; next.textContent = `次のレベルまで ${(100 - percent).toFixed(2)}%`; exp.append(meta, bar, next);
  card.append(header, nameRow, level, exp); card.addEventListener("click", () => onOpenDetail(character.id)); card.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpenDetail(character.id); } }); return card;
}
