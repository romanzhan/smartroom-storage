/**
 * Driving distance via Maps JavaScript API.
 *
 * Uses the modern inline bootstrap loader (`google.maps.importLibrary`) which
 * loads with `loading=async` and exposes libraries on demand. Primary path is
 * `RouteMatrix.computeRouteMatrix` (Routes library, non-deprecated). Falls back
 * to the legacy `DistanceMatrixService` only if the modern API isn't available.
 */

let bootstrapKey = "";
let bootstrapCalled = false;

/**
 * Inject Google's official inline bootstrap loader. Idempotent per page —
 * creates `window.google.maps.importLibrary(name)` that dynamically loads
 * Maps libraries with `loading=async` baked into the URL.
 *
 * @param {string} apiKey
 */
function injectBootstrapLoader(apiKey) {
  if (typeof window === "undefined") return;
  if (window.google?.maps?.importLibrary) return;
  if (bootstrapCalled && bootstrapKey === apiKey) return;

  bootstrapCalled = true;
  bootstrapKey = apiKey;

  // Verbatim from https://developers.google.com/maps/documentation/javascript/load-maps-js-api
  // Produces the URL:
  //   https://maps.googleapis.com/maps/api/js?key=…&v=weekly&loading=async&libraries=…&callback=google.maps.__ib__
  (function (g) {
    let h;
    let a;
    let k;
    const p = "The Google Maps JavaScript API";
    const c = "google";
    const l = "importLibrary";
    const q = "__ib__";
    const m = document;
    let b = window;
    b = b[c] || (b[c] = {});
    const d = b.maps || (b.maps = {});
    const r = new Set();
    const e = new URLSearchParams();
    const u = () =>
      h ||
      (h = new Promise((f, n) => {
        a = m.createElement("script");
        e.set("libraries", [...r] + "");
        for (k in g) {
          e.set(
            k.replace(/[A-Z]/g, (t) => "_" + t[0].toLowerCase()),
            g[k],
          );
        }
        e.set("callback", c + ".maps." + q);
        a.src = `https://maps.${c}apis.com/maps/api/js?` + e;
        d[q] = f;
        a.onerror = () => {
          h = null;
          n(new Error(p + " could not load."));
        };
        a.nonce = m.querySelector("script[nonce]")?.nonce || "";
        m.head.append(a);
      }));
    if (d[l]) {
      console.warn(p + " only loads once. Ignoring:", g);
    } else {
      d[l] = (f, ...n) => r.add(f) && u().then(() => d[l](f, ...n));
    }
  })({
    key: apiKey,
    v: "weekly",
    loading: "async",
  });
}

/**
 * Ensure the Maps JavaScript API bootstrap loader is injected.
 * Returns a promise that resolves once `importLibrary` is available.
 *
 * @param {string} apiKey
 * @returns {Promise<void>}
 */
export function loadMapsJavaScriptApi(apiKey) {
  const key = (apiKey || "").trim();
  if (!key) return Promise.reject(new Error("Missing Google Maps API key"));

  try {
    injectBootstrapLoader(key);
  } catch (err) {
    return Promise.reject(err);
  }

  if (!window.google?.maps?.importLibrary) {
    return Promise.reject(new Error("Google Maps importLibrary bootstrap failed"));
  }

  return Promise.resolve();
}

/**
 * Driving distance in miles between two points.
 *
 * @param {number} originLat
 * @param {number} originLng
 * @param {number} destLat
 * @param {number} destLng
 * @returns {Promise<number|null>}
 */
export async function getDrivingDistanceMilesJs(
  originLat,
  originLng,
  destLat,
  destLng,
) {
  if (
    typeof originLat !== "number" ||
    typeof originLng !== "number" ||
    typeof destLat !== "number" ||
    typeof destLng !== "number" ||
    Number.isNaN(originLat) ||
    Number.isNaN(originLng) ||
    Number.isNaN(destLat) ||
    Number.isNaN(destLng)
  ) {
    return null;
  }

  // Try modern RouteMatrix (no deprecation warning).
  try {
    const distance = await distanceViaRouteMatrix(
      originLat,
      originLng,
      destLat,
      destLng,
    );
    if (distance != null) return distance;
  } catch (err) {
    console.warn("[SmartRoom] RouteMatrix failed, falling back:", err);
  }

  // Fallback to legacy DistanceMatrixService.
  try {
    return await distanceViaLegacyMatrix(
      originLat,
      originLng,
      destLat,
      destLng,
    );
  } catch {
    return null;
  }
}

/**
 * Modern path — `google.maps.routes.RouteMatrix.computeRouteMatrix`.
 * Returns distance in miles, or null on failure.
 */
async function distanceViaRouteMatrix(oLat, oLng, dLat, dLng) {
  console.log("[SmartRoom] RouteMatrix request:", {
    origin: { lat: oLat, lng: oLng },
    destination: { lat: dLat, lng: dLng },
  });

  if (!window.google?.maps?.importLibrary) {
    console.warn("[SmartRoom] importLibrary not available");
    return null;
  }

  const routes = await window.google.maps.importLibrary("routes");
  const RouteMatrix =
    routes?.RouteMatrix ?? window.google?.maps?.routes?.RouteMatrix;
  if (!RouteMatrix || typeof RouteMatrix.computeRouteMatrix !== "function") {
    console.warn("[SmartRoom] RouteMatrix.computeRouteMatrix not found");
    return null;
  }

  // JS SDK accepts LatLngLiteral / LatLng / Place directly in origins/destinations.
  // `fields` is a required FieldMask telling Google which response fields to return
  // (affects billing and performance). Request only what we need.
  const request = {
    origins: [{ lat: oLat, lng: oLng }],
    destinations: [{ lat: dLat, lng: dLng }],
    travelMode: "DRIVING",
    fields: [
      "originIndex",
      "destinationIndex",
      "distanceMeters",
      "condition",
    ],
  };

  const result = await RouteMatrix.computeRouteMatrix(request);
  console.log("[SmartRoom] RouteMatrix raw result:", result);

  // Real response shape (JS SDK, v=weekly):
  //   { matrix: { rows: [{ items: [{ distanceMeters, condition }, ...] }, ...] } }
  // We only send one origin/destination so take the first available item.
  const rows = result?.matrix?.rows ?? result?.rows ?? [];
  for (const row of rows) {
    const items = row?.items ?? row?.elements ?? [];
    for (const item of items) {
      const meters = extractMeters(item);
      if (meters != null) {
        const miles = meters / 1609.344;
        console.log(
          "[SmartRoom] ✓ Distance:",
          meters,
          "meters ≈",
          miles.toFixed(2),
          "miles",
        );
        return miles;
      }
    }
  }
  console.warn("[SmartRoom] RouteMatrix: no usable items in response");

  // Fallback shapes (AsyncIterable / Array / single element) for safety.
  if (result && typeof result[Symbol.asyncIterator] === "function") {
    for await (const element of result) {
      const meters = extractMeters(element);
      if (meters != null) return meters / 1609.344;
    }
  }
  if (Array.isArray(result)) {
    for (const element of result) {
      const meters = extractMeters(element);
      if (meters != null) return meters / 1609.344;
    }
  }
  const meters = extractMeters(result);
  return meters != null ? meters / 1609.344 : null;
}

function extractMeters(element) {
  if (!element) return null;
  const condition = element.condition;
  if (condition && condition !== "ROUTE_EXISTS") return null;

  const candidates = [
    element.distanceMeters,
    element?.distance?.meters,
    element?.distance?.value,
  ];
  for (const v of candidates) {
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
}

/**
 * Legacy path — DistanceMatrixService. Still works but triggers a
 * deprecation warning. Used only when RouteMatrix is unavailable.
 */
async function distanceViaLegacyMatrix(oLat, oLng, dLat, dLng) {
  // Load the legacy "core" / routes library so DistanceMatrixService is defined.
  if (window.google?.maps?.importLibrary) {
    try {
      await window.google.maps.importLibrary("routes");
    } catch {
      /* fall through — library may already be loaded */
    }
  }

  if (!window.google?.maps?.DistanceMatrixService) return null;

  return new Promise((resolve) => {
    try {
      const service = new window.google.maps.DistanceMatrixService();
      service.getDistanceMatrix(
        {
          origins: [{ lat: oLat, lng: oLng }],
          destinations: [{ lat: dLat, lng: dLng }],
          travelMode: window.google.maps.TravelMode.DRIVING,
          unitSystem: window.google.maps.UnitSystem.IMPERIAL,
        },
        (response, status) => {
          if (status !== "OK") {
            resolve(null);
            return;
          }
          const meters =
            response?.rows?.[0]?.elements?.[0]?.distance?.value ?? null;
          resolve(
            typeof meters === "number" ? meters / 1609.344 : null,
          );
        },
      );
    } catch {
      resolve(null);
    }
  });
}
