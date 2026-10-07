// Free, no-API-key geocoding via OpenStreetMap's Nominatim — best-effort/demo-
// grade, not meant for heavy production traffic. Shared by the transport route
// map (resolves a confirmed stop name to coordinates) and the stop-name
// autocomplete (suggests real places while typing, so the name typed is one
// Nominatim can actually find later).
const GEOCODE_CACHE = new Map();

// Soft bias toward the Kathmandu Valley (most schools on this system are
// here) — NOT `bounded=1`, so it nudges ranking rather than excluding
// results elsewhere in Nepal. Without this, a bare local name like "Jorpati"
// can rank a same-named village 30km away above the actual Kathmandu one.
const KATHMANDU_VALLEY_VIEWBOX = '85.20,27.82,85.50,27.62';

async function nominatimSearch(query, limit) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=np&limit=${limit}&viewbox=${KATHMANDU_VALLEY_VIEWBOX}&email=support@geoinfosys.com.np&q=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Nominatim request failed');
  return res.json();
}

// Single best-match point for a confirmed label, cached — used to place a
// route's stops on the map and feed OSRM.
export async function geocode(label) {
  const key = label.trim().toLowerCase();
  if (GEOCODE_CACHE.has(key)) return GEOCODE_CACHE.get(key);
  const results = await nominatimSearch(label, 1);
  const point = results[0] ? [Number(results[0].lat), Number(results[0].lon)] : null;
  GEOCODE_CACHE.set(key, point);
  return point;
}

// Multiple candidate places for a typeahead dropdown while the admin is still
// typing a stop name — not cached, since the partial query text changes on
// every keystroke and caching it wouldn't help.
export async function searchPlaces(query) {
  const results = await nominatimSearch(query, 5);
  return results.map(r => ({
    // Nominatim's full display_name is long ("Chabahil, Kathmandu Metropolitan
    // City, Kathmandu District, Bagmati Province, Nepal") — keep just enough
    // of it to stay identifiable without cluttering the Stops list.
    label: r.display_name.split(',').slice(0, 2).join(',').trim(),
    fullLabel: r.display_name,
    point: [Number(r.lat), Number(r.lon)],
  }));
}
