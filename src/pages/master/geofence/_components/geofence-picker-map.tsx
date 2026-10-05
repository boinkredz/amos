import { memo } from "react";
import { MapContainer, TileLayer, Circle, CircleMarker, useMapEvents, useMap } from "react-leaflet";
import { useEffect } from "react";
import "leaflet/dist/leaflet.css";

type Props = {
  lat: number;
  lng: number;
  radius: number;
  onLocationPick: (lat: number, lng: number) => void;
  className?: string;
};

function ClickHandler({ onLocationPick }: { onLocationPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onLocationPick(
        parseFloat(e.latlng.lat.toFixed(6)),
        parseFloat(e.latlng.lng.toFixed(6)),
      );
    },
  });
  return null;
}

function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng]);
  }, [lat, lng, map]);
  return null;
}

const GeoFencePickerMap = memo(function GeoFencePickerMap({
  lat,
  lng,
  radius,
  onLocationPick,
  className,
}: Props) {
  const validLat = lat && lat >= -90 && lat <= 90 ? lat : -6.2;
  const validLng = lng && lng >= -180 && lng <= 180 ? lng : 106.816;

  return (
    <div className="space-y-1.5">
      <MapContainer
        key={`picker-${validLat.toFixed(3)}-${validLng.toFixed(3)}`}
        center={[validLat, validLng]}
        zoom={16}
        className={className ?? "h-48 w-full rounded-lg border"}
        scrollWheelZoom={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <Circle
          center={[validLat, validLng]}
          radius={radius}
          pathOptions={{ color: "#f59e0b", fillColor: "#f59e0b", fillOpacity: 0.15 }}
        />
        <CircleMarker
          center={[validLat, validLng]}
          radius={6}
          pathOptions={{ color: "#f59e0b", fillColor: "#f59e0b", fillOpacity: 1 }}
        />
        <ClickHandler onLocationPick={onLocationPick} />
        <RecenterMap lat={validLat} lng={validLng} />
      </MapContainer>
      <p className="text-xs text-muted-foreground">Klik di peta untuk memilih lokasi pusat zona, atau gunakan tombol GPS di bawah.</p>
    </div>
  );
});

export default GeoFencePickerMap;
