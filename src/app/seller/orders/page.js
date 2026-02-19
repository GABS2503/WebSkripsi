"use client";
import { useEffect, useState } from 'react';
import axios from 'axios';
import dynamic from 'next/dynamic';
import Link from 'next/link';

// Dynamically import map to view location
const MapViewer = dynamic(() => import('@/components/MapViewer'), { ssr: false });

// --- CRITICAL FIX: Safe JSON Parser ---
const safeParseJSON = (data, fallback) => {
  if (!data) return fallback;
  // If Strapi already converted it to an object/array, return it directly!
  if (typeof data === 'object') return data; 
  
  // If it's still a string, try to parse it
  try {
    return JSON.parse(data);
  } catch (e) {
    console.error("Failed to parse JSON:", data);
    return fallback;
  }
};

export default function SellerOrders() {
  const [orders, setOrders] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (u) {
        const userData = JSON.parse(u);
        setUser(userData);
        fetchOrders(userData.id);
    } else {
        setLoading(false);
    }
  }, []);

  const fetchOrders = async (userId) => {
    try {
        const token = localStorage.getItem('token'); 
        const res = await axios.get(
            `${process.env.NEXT_PUBLIC_API_URL}/api/orders?filters[seller][id][$eq]=${userId}&sort=createdAt:desc&populate=*`, 
            {
                headers: { Authorization: `Bearer ${token}` } 
            }
        );
        
        setOrders(res.data.data);
    } catch (err) {
        console.error("Error fetching orders:", err);
    } finally {
        setLoading(false);
    }
  };

  if (loading) return <div style={{padding:'2rem'}}>Loading orders...</div>;

  return (
    <div style={{ padding: '2rem', background: '#f3f4f6', minHeight: '100vh' }}>
      <Link href="/seller" style={{marginBottom:'20px', display:'block', color:'#2563eb', fontWeight:'bold'}}>← Back to Dashboard</Link>
      <h1 style={{marginBottom:'1.5rem'}}>Seller Zone: Incoming Orders</h1>

      {orders.length === 0 && (
          <div style={{background:'white', padding:'2rem', borderRadius:'8px', textAlign:'center', color:'#666'}}>
              No orders yet.
          </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {orders.map((order) => {
            const data = order.attributes || order;
            
            // --- USE SAFE PARSER HERE ---
            const location = safeParseJSON(data.delivery_location, null);
            const items = safeParseJSON(data.items, []);

            return (
                <div key={order.id} style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
                    <div style={{display:'flex', justifyContent:'space-between', borderBottom:'1px solid #eee', paddingBottom:'10px'}}>
                        <h3 style={{margin:0}}>Order #{data.order_id}</h3>
                        <span style={{background: data.order_status === 'paid' ? '#d1fae5' : '#fef3c7', padding:'4px 12px', borderRadius:'12px', fontSize:'0.9rem', fontWeight:'bold', color: data.order_status === 'paid' ? '#065f46' : '#92400e'}}>
                            {data.order_status ? data.order_status.toUpperCase() : 'PENDING'}
                        </span>
                    </div>

                    <div style={{marginTop:'15px'}}>
                        <strong>Buyer Name:</strong> {data.buyer_name}<br/>
                        <strong>Items Purchased:</strong>
                        <ul style={{marginTop:'5px', color:'#374151', background:'#f9fafb', padding:'10px 10px 10px 30px', borderRadius:'6px'}}>
                            {Array.isArray(items) && items.map((i, idx) => (
                                <li key={idx} style={{marginBottom:'5px'}}>
                                    <b>{i.qty}x</b> {i.name} — Rp {i.price?.toLocaleString()}
                                </li>
                            ))}
                        </ul>
                        <div style={{fontSize:'1.1rem', marginTop:'10px'}}>
                            <strong>Total Earned:</strong> <span style={{color:'#B12704'}}>Rp {data.total_price?.toLocaleString()}</span>
                        </div>
                    </div>

                    {/* MAP VIEWER */}
                    {location && location.lat && (
                        <div style={{marginTop:'20px', borderTop:'1px solid #eee', paddingTop:'15px'}}>
                            <h4 style={{margin:'0 0 10px 0', display:'flex', alignItems:'center', gap:'5px'}}>
                                📍 {location.type === 'home_service' ? 'Service Location' : location.type === 'shipping' ? 'Delivery Destination' : 'Pickup in Store'}
                            </h4>
                            {location.address_note && (
                                <p style={{fontSize:'0.9rem', color:'#4b5563', background:'#eff6ff', padding:'10px', borderRadius:'4px', borderLeft:'4px solid #3b82f6', margin:'0 0 15px 0'}}>
                                    <b>Buyer Note:</b> {location.address_note}
                                </p>
                            )}
                            
                            <div style={{height:'250px', width:'100%', border:'2px solid #e5e7eb', borderRadius:'8px', overflow:'hidden'}}>
                                <MapViewer lat={location.lat} lng={location.lng} />
                            </div>
                            {/* Fixed Google Maps Link */}
                            <a 
                                href={`https://www.google.com/maps?q=${location.lat},${location.lng}`} 
                                target="_blank"
                                rel="noreferrer"
                                style={{display:'inline-block', marginTop:'10px', color:'#fff', background:'#2563eb', padding:'8px 16px', borderRadius:'4px', textDecoration:'none', fontWeight:'bold', fontSize:'0.9rem'}}
                            >
                                Open in Google Maps ↗
                            </a>
                        </div>
                    )}
                </div>
            );
        })}
      </div>
    </div>
  );
}
