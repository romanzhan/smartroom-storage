const AUTocomplete_URL = "https://places.googleapis.com/v1/places:autocomplete";
const AUTocomplete_FIELD_MASK =
  "suggestions.placePrediction.placeId,suggestions.placePrediction.text";

/**
 * @returns {string}
 */
export function newSessionToken() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `st-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * @param {string} input
 * @param {string} sessionToken
 * @param {string} apiKey
 * @returns {Promise<{ ok: boolean, status: number, predictions: Array<{ placeId: string, text: string }> }>}
 */
export async function fetchPlaceAutocomplete(input, sessionToken, apiKey) {
  const trimmed = (input || "").trim();
  if (!trimmed || !apiKey) {
    return { ok: false, status: 0, predictions: [] };
  }

  const res = await fetch(AUTocomplete_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": AUTocomplete_FIELD_MASK,
    },
    body: JSON.stringify({
      input: trimmed,
      includedRegionCodes: ["gb"],
      sessionToken,
    }),
  });

  if (!res.ok) {
    return { ok: false, status: res.status, predictions: [] };
  }

  const data = await res.json();
  const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
  const out = [];
  for (const s of suggestions) {
    const p = s.placePrediction;
    if (!p?.placeId || !p.text?.text) continue;
    out.push({ placeId: p.placeId, text: p.text.text });
  }
  return { ok: true, status: res.status, predictions: out };
}

/**
 * @param {string} placeId
 * @param {string} sessionToken
 * @param {string} apiKey
 * @returns {Promise<{ ok: boolean, status: number, body: object|null }>}
 */
export async function fetchPlaceDetails(placeId, sessionToken, apiKey) {
  if (!placeId || !apiKey) {
    return { ok: false, status: 0, body: null };
  }

  const enc = encodeURIComponent(placeId);
  const qs = sessionToken
    ? `?sessionToken=${encodeURIComponent(sessionToken)}`
    : "";
  const url = `https://places.googleapis.com/v1/places/${enc}${qs}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "id,formattedAddress,addressComponents,location",
    },
  });

  if (!res.ok) {
    return { ok: false, status: res.status, body: null };
  }

  const body = await res.json();
  return {
    ok: true,
    status: res.status,
    body: body && typeof body === "object" ? body : null,
  };
}

/**
 * @param {Array<{ longText?: string, shortText?: string, types?: string[] }>} components
 */
export function parseAddressComponents(components) {
  const byType = new Map();
  if (!Array.isArray(components)) {
    return {
      postcode: "",
      addressLine1: "",
      addressLine2: "",
      town: "",
    };
  }

  for (const c of components) {
    const types = Array.isArray(c.types) ? c.types : [];
    for (const t of types) {
      if (!byType.has(t)) byType.set(t, c.longText || c.shortText || "");
    }
  }

  const streetNumber = byType.get("street_number") || "";
  const route = byType.get("route") || "";
  const line1 = [streetNumber, route].filter(Boolean).join(" ").trim();

  const subpremise = byType.get("subpremise") || "";
  const premise = byType.get("premise") || "";
  const line2 = subpremise || premise || "";

  const town =
    byType.get("postal_town") ||
    byType.get("locality") ||
    byType.get("administrative_area_level_2") ||
    "";

  const postcode = (byType.get("postal_code") || "").trim();

  return {
    postcode,
    addressLine1: line1,
    addressLine2: line2,
    town,
  };
}

/**
 * @param {object|null} details Places API (New) place resource
 */
export function placeDetailsToResolved(details) {
  if (!details?.location) return null;

  const lat = details.location.latitude;
  const lng = details.location.longitude;
  if (typeof lat !== "number" || typeof lng !== "number") return null;

  const parsed = parseAddressComponents(details.addressComponents);
  const formattedAddress =
    typeof details.formattedAddress === "string"
      ? details.formattedAddress
      : "";

  const rawId = details.name || details.id || "";
  const placeId = String(rawId).replace(/^places\//, "");

  return {
    placeId,
    formattedAddress,
    lat,
    lng,
    postcode: parsed.postcode,
    addressLine1: parsed.addressLine1,
    addressLine2: parsed.addressLine2,
    town: parsed.town,
  };
}

/**
 * Driving distance in miles (Distance Matrix API, imperial).
 * @returns {Promise<{ ok: boolean, status: number, miles: number|null }>}
 */
export async function fetchDrivingMilesImperial(
  originLat,
  originLng,
  destLat,
  destLng,
  apiKey,
) {
  if (!apiKey) {
    return { ok: false, status: 0, miles: null };
  }
  const origins = `${originLat},${originLng}`;
  const destinations = `${destLat},${destLng}`;
  const params = new URLSearchParams({
    origins,
    destinations,
    units: "imperial",
    key: apiKey,
  });
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?${params}`;

  const res = await fetch(url);
  if (!res.ok) {
    return { ok: false, status: res.status, miles: null };
  }

  const data = await res.json();
  const el = data?.rows?.[0]?.elements?.[0];
  if (!el || el.status !== "OK") {
    return { ok: false, status: res.status, miles: null };
  }

  const meters = el.distance?.value;
  if (typeof meters !== "number") {
    return { ok: false, status: res.status, miles: null };
  }

  return {
    ok: true,
    status: res.status,
    miles: meters / 1609.344,
  };
}
