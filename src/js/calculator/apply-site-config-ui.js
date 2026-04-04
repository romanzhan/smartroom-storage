function setPromoText(el, percent) {
  if (!el) return;
  const n = Math.round(Number(percent) || 0);
  el.innerHTML = `The longer you store, the more you save. Enjoy a <strong>${n}% discount!</strong>`;
}

export function applySiteConfigUi(dom, siteConfig) {
  const pct = siteConfig?.globalDiscount ?? 45;
  setPromoText(dom.durationPromo, pct);
  setPromoText(dom.durationPromoFurn, pct);
}
