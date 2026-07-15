export const MAX_LEVEL = 300;

export function createId() {
  return window.crypto?.randomUUID?.()
    ?? `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

export function toHalfWidth(value) {
  return String(value).replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0));
}

export function normalizeLevel(value) {
  const digits = toHalfWidth(value).replace(/[^0-9]/g, "");
  if (!digits) return "";
  return String(Math.min(MAX_LEVEL, Math.max(1, Number(digits))));
}

// previousExp is always the previous day's EXP percentage, not an EXP amount.
export function normalizePercentage(value) {
  const cleaned = toHalfWidth(value).replace(/[^0-9.]/g, "");
  if (!cleaned || cleaned === ".") return "";
  const [integer = "", ...decimal] = cleaned.split(".");
  const number = Math.min(100, Math.max(0, Number(`${integer}.${decimal.join("")}`)));
  return String(Math.round(number * 100) / 100);
}

export function getPercentage(value) {
  return Math.min(100, Math.max(0, Number(value) || 0));
}

export function localDateKey(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}
