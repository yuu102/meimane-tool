export function downloadBackup(characters) {
  const blob = new Blob([JSON.stringify({ app: "meimane-tool", version: "3.2", exportedAt: new Date().toISOString(), characters }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob); const link = document.createElement("a");
  link.href = url; link.download = `meimane-tool-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 0);
}
export function readBackup(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => { try { const parsed = JSON.parse(reader.result); const records = Array.isArray(parsed) ? parsed : parsed?.characters; if (!Array.isArray(records)) throw new Error(); resolve(records); } catch { reject(new Error("JSONが正しくありません。")); } }; reader.onerror = () => reject(new Error("ファイルを読み込めません。")); reader.readAsText(file, "UTF-8"); }); }
