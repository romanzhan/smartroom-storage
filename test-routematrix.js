// ============================================================
// Self-contained RouteMatrix test.
// Copy EVERYTHING in this file and paste into the browser console.
// Requires: window.__SMARTROOM_SITE_CONFIG__.googleMapsApiKey to be set.
// ============================================================

(async () => {
  const key = window.__SMARTROOM_SITE_CONFIG__?.googleMapsApiKey;
  if (!key) {
    console.error("NO KEY in window.__SMARTROOM_SITE_CONFIG__.googleMapsApiKey");
    return;
  }
  console.log("Using key:", key.slice(0, 12) + "...");

  // Inject Google bootstrap loader if the calculator hasn't already done it.
  if (!window.google?.maps?.importLibrary) {
    console.log("Injecting bootstrap loader...");
    const s = document.createElement("script");
    s.textContent =
      '(g=>{var h,a,k,p="The Google Maps JavaScript API",c="google",l="importLibrary",q="__ib__",m=document,b=window;b=b[c]||(b[c]={});var d=b.maps||(b.maps={}),r=new Set,e=new URLSearchParams,u=()=>h||(h=new Promise(async(f,n)=>{a=m.createElement("script");e.set("libraries",[...r]+"");for(k in g)e.set(k.replace(/[A-Z]/g,t=>"_"+t[0].toLowerCase()),g[k]);e.set("callback",c+".maps."+q);a.src="https://maps."+c+"apis.com/maps/api/js?"+e;d[q]=f;a.onerror=()=>{h=null;n(Error(p+" could not load."))};a.nonce=m.querySelector("script[nonce]")?.nonce||"";m.head.append(a)}));d[l]?console.warn(p+" only loads once. Ignoring:",g):d[l]=(f,...n)=>r.add(f)&&u().then(()=>d[l](f,...n))})(' +
      JSON.stringify({ key: key, v: "weekly", loading: "async" }) +
      ");";
    document.head.appendChild(s);
  }

  if (typeof window.google?.maps?.importLibrary !== "function") {
    console.error("importLibrary still undefined after injection");
    return;
  }

  console.log("Importing routes library...");
  const routes = await window.google.maps.importLibrary("routes");
  console.log("routes namespace keys:", Object.keys(routes || {}));
  console.log("RouteMatrix:", routes?.RouteMatrix);
  console.log("window.google.maps.TravelMode:", window.google?.maps?.TravelMode);

  if (!routes?.RouteMatrix?.computeRouteMatrix) {
    console.error("RouteMatrix.computeRouteMatrix not available");
    return;
  }

  const travelModes = ["DRIVING", "DRIVE", "driving", "drive"];
  for (const mode of travelModes) {
    try {
      console.log("Trying travelMode:", mode);
      const result = await routes.RouteMatrix.computeRouteMatrix({
        origins: [{ lat: 51.5074, lng: -0.1278 }],
        destinations: [{ lat: 51.5229, lng: -0.1195 }],
        travelMode: mode,
        fields: [
          "originIndex",
          "destinationIndex",
          "distanceMeters",
          "condition",
        ],
      });
      let found = null;
      for await (const el of result) {
        found = el;
        break;
      }
      if (found?.distanceMeters != null) {
        console.log(
          "%cSUCCESS with travelMode=" + mode,
          "color:green;font-weight:bold",
          {
            condition: found.condition,
            distanceMeters: found.distanceMeters,
            miles: (found.distanceMeters / 1609.344).toFixed(2),
          },
        );
        return;
      }
      console.warn("Empty result for mode", mode);
    } catch (err) {
      console.warn("FAILED mode=" + mode + ":", err?.message);
    }
  }

  console.error("All travelMode variants failed");
})();
