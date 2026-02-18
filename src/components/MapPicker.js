"use client";
import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet's default icon issue in React
const icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function LocationMarker({ position, setPosition }) {
  const map = useMapEvents({
    click(e) {
      setPosition(e.latlng);
      map.flyTo(e.latlng, map.getZoom());
    },
  });

  return position === null ? null : (
    <Marker position={position} icon={icon}></Marker>
  );
}

export default function MapPicker({ onLocationSelect }) {
  // Default center (Jakarta). You can change this to your region.
  const [position, setPosition] = useState(null);

  useEffect(() => {
    if (position && onLocationSelect) {
      onLocationSelect(position);
    }
  }, [position, onLocationSelect]);

  return (
    <div style={{ height: '300px', width: '100%', borderRadius: '8px', overflow: 'hidden', border: '2px solid #ddd' }}>
      <MapContainer 
        center={[-6.2088, 106.8456]} 
        zoom={13} 
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
        />
        <LocationMarker position={position} setPosition={setPosition} />
      </MapContainer>
      <div style={{marginTop: '5px', fontSize: '0.8rem', color: '#666', textAlign: 'center'}}>
        {position ? `Selected: ${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}` : "Tap on the map to pin location"}
      </div>
    </div>
  );
}