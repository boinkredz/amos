import { useEffect, memo } from "react";
import { MapContainer, TileLayer, Circle, CircleMarker, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

type Props = {
  lat: number;
  lng: number;
  radius: number;
  label?: string;
  className?: string;
};

function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng]);
  }, [lat, lng, map]);
  return null;
}

// Memo to prevent unnecessary re-renders that cause Leaflet unmount race conditions
const GeoFenceMap = memo(function GeoFenceMap({ lat, lng, radius, label: _label, className }: Props) {
  if (!lat || !lng) return null;

  return (
    <MapContainer
      // Keyed by coordinates so Leaflet remounts cleanly when location changes
      key={`map-${lat.toFixed(6)}-${lng.toFixed(6)}`}
      center={[lat, lng]}
      zoom={16}
      className={className ?? "h-48 w-full rounded-lg"}
      scrollWheelZoom={false}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      {/* Geofence area */}
      <Circle
        center={[lat, lng]}
        radius={radius}
        pathOptions={{ color: "#f59e0b", fillColor: "#f59e0b", fillOpacity: 0.15 }}
      />
      {/* Center point - using CircleMarker to avoid Leaflet Icon unmount issues */}
      <CircleMarker
        center={[lat, lng]}
        radius={6}
        pathOptions={{ color: "#f59e0b", fillColor: "#f59e0b", fillOpacity: 1 }}
      />
      <RecenterMap lat={lat} lng={lng} />
    </MapContainer>
  );
});

export default GeoFenceMap;
