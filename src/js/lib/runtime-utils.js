/**
 * Isolated error boundaries for calculator runtime (no UI change).
 * @param {string} label
 * @param {() => void} fn
 */
export function runSafe(label, fn) {
  try {
    fn();
  } catch (err) {
    console.error(`[SmartRoom] ${label}`, err);
  }
}

/**
 * @param {Array<(event: unknown, snapshot: unknown) => void>} listeners
 * @param {unknown} event
 * @param {unknown} snapshot
 */
export function notifyEachSafe(listeners, event, snapshot) {
  for (const fn of listeners) {
    runSafe("store listener", () => fn(event, snapshot));
  }
}

/**
 * @param {typeof import("gsap").gsap | undefined} gsapRef
 * @param {Element | string | null | undefined} target
 * @param {Record<string, unknown>} vars
 */
export function gsapTo(gsapRef, target, vars) {
  if (typeof gsapRef?.to !== "function") return;
  const el = resolveGsapTarget(target);
  if (!el) return;
  try {
    return gsapRef.to(el, vars);
  } catch (err) {
    console.error("[SmartRoom] gsap.to", err);
  }
}

/**
 * @param {typeof import("gsap").gsap | undefined} gsapRef
 * @param {Element | string | null | undefined} target
 * @param {Record<string, unknown>} fromVars
 * @param {Record<string, unknown>} toVars
 */
export function gsapFromTo(gsapRef, target, fromVars, toVars) {
  if (typeof gsapRef?.fromTo !== "function") return;
  const el = resolveGsapTarget(target);
  if (!el) return;
  try {
    return gsapRef.fromTo(el, fromVars, toVars);
  } catch (err) {
    console.error("[SmartRoom] gsap.fromTo", err);
  }
}

/**
 * @param {Element | string | null | undefined} target
 * @returns {Element | null}
 */
function resolveGsapTarget(target) {
  if (target == null) return null;
  if (typeof target === "object" && "nodeType" in target) {
    return /** @type {Element} */ (target);
  }
  if (typeof target === "string") {
    if (target.startsWith("#")) {
      return document.getElementById(target.slice(1));
    }
    return document.querySelector(target);
  }
  return null;
}

/**
 * @param {unknown} d
 * @returns {d is Date}
 */
export function isValidDate(d) {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

/**
 * scrollTo plugin (GSAP) — guard if plugin missing.
 * @param {{ to?: (target: unknown, vars: Record<string, unknown>) => unknown } | null | undefined} gsapRef
 * @param {Record<string, unknown>} vars
 */
export function gsapScrollWindow(gsapRef, vars) {
  if (typeof gsapRef?.to !== "function") return;
  try {
    return gsapRef.to(window, vars);
  } catch (err) {
    console.error("[SmartRoom] gsap window scroll", err);
  }
}
