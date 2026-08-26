import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Loader2, MapPin } from 'lucide-react';
import { geocode } from '@/lib/nominatim';
import 'leaflet/dist/leaflet.css';

// Leaflet's default marker icon URLs break under bundlers (Vite included) —
// they're built assuming a specific relative path that doesn't survive
// bundling. Standard workaround: re-point them at the packaged image URLs.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
  iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
  shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
});

const KATHMANDU_CENTER = [27.7172, 85.3240];

// Routing (public OSRM demo) — best-effort/demo-grade, see the hint rendered
// below the map. Geocoding is shared with the stop-name autocomplete, see lib/nominatim.
async function fetchRoutePath(points) {
  if (points.length < 2) return null;
  const coordStr = points.map(([lat, lon]) => `${lon},${lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const coords = data?.routes?.[0]?.geometry?.coordinates;
  if (!coords) return null;
  return coords.map(([lon, lat]) => [lat, lon]);
}

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) map.setView(points[0], 13);
    else map.fitBounds(points, { padding: [30, 30] });
  }, [points, map]);
  return null;
}

// Live route preview — geocodes every stop (debounced), then asks OSRM to
// route *through* them in order. Deliberately keyed only off the Stops list,
// not the free-text Route Name (parsing a name like "Route A — Chabahil–Baudha"
// for endpoints was fragile — dash characters vary, and duplicated whatever
// the admin also listed as a stop, producing garbage routes). Routing through
// waypoints in order is what makes stops like "Koteshwor, Balkumari" naturally
// trace the Ring Road between them, rather than any road-selection logic we'd
// have to hand-write.
export default function TransportRouteMap({ stops }) {
  const [status, setStatus] = useState('idle'); // idle | loading | done | error
  const [markers, setMarkers] = useState([]); // [{ label, point }]
  const [path, setPath] = useState(null);
  const debounceRef = useRef(null);

  const waypointLabels = useMemo(() => (stops || []).map(s => s.trim()).filter(Boolean), [stops]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (waypointLabels.length === 0) {
      setStatus('idle');
      setMarkers([]);
      setPath(null);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setStatus('loading');
      try {
        const geocoded = await Promise.all(waypointLabels.map(async label => ({ label, point: await geocode(`${label}, Nepal`) })));
        const resolved = geocoded.filter(g => g.point);
        setMarkers(resolved);
        if (resolved.length >= 2) {
          const routePath = await fetchRoutePath(resolved.map(g => g.point));
          setPath(routePath ?? resolved.map(g => g.point));
        } else {
          setPath(null);
        }
        setStatus('done');
      } catch {
        setStatus('error');
      }
    }, 600);
    return () => clearTimeout(debounceRef.current);
  }, [waypointLabels]);

  const center = markers[0]?.point || KATHMANDU_CENTER;

  return (
    <div className="space-y-1.5">
      <div className="rounded-lg overflow-hidden border border-border relative" style={{ height: 260 }}>
        <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
          <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {markers.map((m, i) => (
            <Marker key={`${m.label}-${i}`} position={m.point}>
              <Popup>{m.label}</Popup>
            </Marker>
          ))}
          {path && <Polyline positions={path} pathOptions={{ color: '#0284c7', weight: 4 }} />}
          <FitBounds points={markers.map(m => m.point)} />
        </MapContainer>
        {status === 'loading' && (
          <div className="absolute top-2 right-2 bg-white/90 rounded-md px-2 py-1 text-xs flex items-center gap-1.5 shadow-sm">
            <Loader2 className="w-3 h-3 animate-spin" /> Locating…
          </div>
        )}
        {waypointLabels.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-xs text-muted-foreground gap-1.5">
            <MapPin className="w-3.5 h-3.5" /> Add stops below to preview the route on the map
          </div>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Free OpenStreetMap-based preview — best-effort geocoding, not a substitute for confirming stops on the ground.
      </p>
    </div>
  );
}
