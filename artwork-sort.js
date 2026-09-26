// Shared sorting rules for the public museum and the local gallery manager.
window.artworkSort = (() => {
  const alphabet = new Intl.Collator("sv", { sensitivity: "base", numeric: true });

  function price(text) {
    const match = String(text || "").match(/\d[\d\s\u00a0.,]*/);
    return match ? Number(match[0].replace(/\D/g, "")) : null;
  }

  function area(text) {
    const value = String(text || "").toLowerCase();
    if (/\bpx\b/.test(value)) return null;
    const match = value.match(/(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+(?:[.,]\d+)?)/);
    if (!match) return null;
    const unit = value.slice(match.index + match[0].length).match(/\b(mm|cm|m)\b/);
    const scale = unit?.[1] === "mm" ? .1 : unit?.[1] === "m" ? 100 : 1;
    return Number(match[1].replace(",", ".")) * Number(match[2].replace(",", ".")) * scale * scale;
  }

  function year(text) {
    const match = String(text || "").match(/\b(?:19|20)\d{2}\b/);
    return match ? Number(match[0]) : null;
  }

  function number(text) {
    const value = String(text || "").trim();
    return !value || /^ej angivet$/i.test(value) ? null : value;
  }

  const modes = {
    title: [details => details.title || "Utan titel", false],
    "price-asc": [details => price(details.price), false],
    "price-desc": [details => price(details.price), true],
    "area-asc": [details => area(details.dimensions), false],
    "area-desc": [details => area(details.dimensions), true],
    "year-asc": [details => year(details.year), false],
    "year-desc": [details => year(details.year), true],
    medium: [details => number(details.medium), false]
  };

  function sort(items, detailsOf, mode) {
    if (!modes[mode]) return [...items];
    const [metric, descending] = modes[mode];
    return [...items].sort((a, b) => {
      const left = metric(detailsOf(a));
      const right = metric(detailsOf(b));
      if (left == null && right == null) return 0;
      if (left == null) return 1;
      if (right == null) return -1;
      const comparison = typeof left === "number" ? left - right : alphabet.compare(left, right);
      return descending ? -comparison : comparison;
    });
  }

  return { sort, price, area };
})();
