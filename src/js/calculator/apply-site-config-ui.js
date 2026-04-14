function setPromoText(el, percent) {
  if (!el) return;
  const n = Math.round(Number(percent) || 0);
  el.innerHTML = `The longer you store, the more you save. Enjoy a <strong>${n}% discount!</strong>`;
}

function maxDiscount(tiers) {
  if (!Array.isArray(tiers) || !tiers.length) return 0;
  return tiers.reduce((m, t) => Math.max(m, Number(t?.discount) || 0), 0);
}

export function applySiteConfigUi(dom, siteConfig) {
  const pct = maxDiscount(siteConfig?.durationDiscounts);
  setPromoText(dom.durationPromo, pct);
  setPromoText(dom.durationPromoFurn, pct);
}
