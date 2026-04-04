export function escapeHTML(str) {
  if (typeof str !== "string") return String(str);
  return str.replace(/[&<>'"]/g, (tag) =>
    ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    }[tag]),
  );
}
