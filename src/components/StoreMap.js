"use client";
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet icons
const icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export default function StoreMap({ sellers }) {
  if (!sellers || sellers.length === 0) {
    return <div style={{padding:'2rem', textAlign:'center', background:'#f8fafc', borderRadius:'12px', border:'1px solid #e2e8f0'}}>No stores have pinned their locations yet.</div>;
  }

  // Center map on the first seller's location
  const center = [sellers[0].lat, sellers[0].lng];

  return (
    <div style={{ height: '400px', width: '100%', borderRadius: '16px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
      <MapContainer center={center} zoom={11} style={{ height: '100%', width: '100%' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
        {sellers.map((s) => (
           <Marker key={s.id} position={[s.lat, s.lng]} icon={icon}>
             <Popup>
               <div style={{textAlign:'center'}}>
                 <strong style={{fontSize:'1.1rem', color:'#2563eb'}}>{s.shopName}</strong><br/>
                 <p style={{fontSize:'0.9rem', margin:'5px 0', color:'#475569'}}>{s.shopDescription || "Local MSME Store"}</p>
                 <span style={{fontSize:'0.8rem', background:'#e0e7ff', padding:'2px 8px', borderRadius:'10px', color:'#4338ca'}}>Verified Seller</span>
               </div>
             </Popup>
           </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
