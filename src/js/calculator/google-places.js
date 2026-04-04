const AUTocomplete_URL = "https://places.googleapis.com/v1/places:autocomplete";
const AUTocomplete_FIELD_MASK =
  "suggestions.placePrediction.placeId,suggestions.placePrediction.text";

/** BCP-47; UK English for London-facing copy (overrides browser locale for API text). */
const PLACES_LANGUAGE_CODE = "en-GB";

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
      languageCode: PLACES_LANGUAGE_CODE,
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
  const placeQs = new URLSearchParams();
  placeQs.set("languageCode", PLACES_LANGUAGE_CODE);
  placeQs.set("regionCode", "GB");
  if (sessionToken) placeQs.set("sessionToken", sessionToken);
  const qs = `?${placeQs.toString()}`;
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
function componentText(c) {
  if (!c || typeof c !== "object") return "";
  return (
    c.longText ||
    c.shortText ||
    (typeof c.text === "string" ? c.text : "") ||
    ""
  );
}

/**
 * When Google returns sparse components (e.g. postcode-only or venue names), derive a usable line 1.
 * @param {{ postcode: string, addressLine1: string, addressLine2: string, town: string }} parsed
 * @param {string} formattedAddress
 */
export function enrichParsedAddressFromFormatted(parsed, formattedAddress) {
  const fa = (formattedAddress || "").trim();
  if (!fa) return parsed;

  const segments = fa.split(",").map((s) => s.trim()).filter(Boolean);
  if (segments.length === 0) return parsed;

  const ukPostcodeRe = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

  if (!(parsed.addressLine1 || "").trim()) {
    let i = 0;
    while (i < segments.length && ukPostcodeRe.test(segments[i])) i++;
    if (i < segments.length) {
      const candidate = segments[i];
      if (!ukPostcodeRe.test(candidate)) {
        parsed.addressLine1 = candidate;
      }
    }
  }

  if (!(parsed.town || "").trim()) {
    for (let j = segments.length - 1; j >= 0; j--) {
      if (ukPostcodeRe.test(segments[j])) {
        if (j > 0) {
          const maybeTown = segments[j - 1];
          if (!ukPostcodeRe.test(maybeTown) && maybeTown.length > 2) {
            parsed.town = maybeTown;
          }
        }
        break;
      }
    }
  }

  return parsed;
}

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
    const text = componentText(c);
    for (const t of types) {
      if (!byType.has(t)) byType.set(t, text);
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
    byType.get("sublocality") ||
    byType.get("sublocality_level_1") ||
    byType.get("neighborhood") ||
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

  const formattedAddress =
    typeof details.formattedAddress === "string"
      ? details.formattedAddress
      : "";

  const parsed = enrichParsedAddressFromFormatted(
    parseAddressComponents(details.addressComponents),
    formattedAddress,
  );

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
    language: PLACES_LANGUAGE_CODE,
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
