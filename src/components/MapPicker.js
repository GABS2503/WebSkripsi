"use client";
import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
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

// Component to handle mouse clicks on the map
// ... keep your imports and Leaflet icon setup at the top ...

// Component to handle mouse clicks on the map
function LocationMarker({ position, setPosition }) {
  useMapEvents({
    click(e) {
      setPosition(e.latlng);
    },
  });
  return position === null ? null : <Marker position={position} icon={icon}></Marker>;
}

// Component to smoothly fly the map to a searched location
function MapController({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, 15, { animate: true, duration: 1.5 });
    }
  }, [center, map]);
  return null;
}

// FIXED: Now accepts BOTH 'setLocation' (for Seller page) and 'onLocationSelect' (for Item page)
export default function MapPicker({ location, setLocation, onLocationSelect }) {
  // --- DEFAULT TO MANADO CITY ---
  const manadoCoords = [1.4822, 124.8489];
  
  const initialPos = location && location.lat ? location : null;
  const initialCenter = initialPos ? [initialPos.lat, initialPos.lng] : manadoCoords;

  const [position, setPosition] = useState(initialPos);
  const [mapCenter, setMapCenter] = useState(initialCenter);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // We create a single updater function that uses whichever prop the parent page provided
  const updateParentLocation = setLocation || onLocationSelect;

  // Send the selected location back to the parent page
  useEffect(() => {
    if (position && updateParentLocation) {
        updateParentLocation(position);
    }
  }, [position, updateParentLocation]); 

  // --- SEARCH FUNCTION USING OPENSTREETMAP ---
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        
        setPosition({ lat, lng });
        setMapCenter([lat, lng]);
      } else {
        alert("Location not found. Try adding 'Manado' to your search (e.g., 'Megamas Manado').");
      }
    } catch (err) {
      console.error("Search error", err);
      alert("Search failed. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  return (
    <div style={{ marginBottom: '10px' }}>
      
      {/* --- SEARCH BAR --- */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <input 
          type="text" 
          placeholder="Search location (e.g. Mantos, Manado)" 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{ flex: 1, padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.95rem', color: '#0f172a' }}
        />
        <button 
          type="button" 
          onClick={handleSearch}
          disabled={isSearching}
          style={{ padding: '0 20px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: isSearching ? 'not-allowed' : 'pointer', fontWeight: 'bold', transition: 'background 0.2s' }}
        >
          {isSearching ? '...' : 'Search'}
        </button>
      </div>

      {/* --- LEAFLET MAP --- */}
      <div style={{ height: '300px', width: '100%', borderRadius: '12px', overflow: 'hidden', border: '2px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer 
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
            attribution='&copy; OpenStreetMap contributors' 
          />
          <LocationMarker position={position} setPosition={setPosition} />
          <MapController center={mapCenter} />
        </MapContainer>
      </div>

      <div style={{textAlign:'center', fontSize:'0.85rem', color:'#64748b', padding:'8px 0', fontWeight: '500'}}>
        {position ? `📍 Pinned at: ${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}` : "Click on the map or use the search bar to pin a location"}
      </div>
    </div>
  );
}

