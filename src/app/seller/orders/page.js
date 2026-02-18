"use client";
import { useEffect, useState } from 'react';
import axios from 'axios';
import dynamic from 'next/dynamic';
import Link from 'next/link';

// Dynamically import map to view location
const MapViewer = dynamic(() => import('@/components/MapViewer'), { ssr: false });

export default function SellerOrders() {
  const [orders, setOrders] = useState([]);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (u) {
        const userData = JSON.parse(u);
        setUser(userData);
        fetchOrders(userData.id);
    }
  }, []);

  const fetchOrders = async (userId) => {
    try {
        // Filter orders where seller.id matches current user
        // Note: You might need to adjust filter syntax based on Strapi v4 vs v5
        const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/orders?filters[seller][id][$eq]=${userId}&sort=createdAt:desc&populate=*`);
        setOrders(res.data.data);
    } catch (err) {
        console.error("Error fetching orders", err);
    }
  };

  return (
    <div style={{ padding: '2rem', background: '#f3f4f6', minHeight: '100vh' }}>
      <Link href="/" style={{marginBottom:'20px', display:'block'}}>&larr; Back to Market</Link>
      <h1>Seller Zone: Incoming Orders</h1>

      {orders.length === 0 && <p>No orders yet.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {orders.map((order) => {
            const data = order.attributes || order;
            const location = data.delivery_location ? JSON.parse(data.delivery_location) : null;
            const items = data.items ? JSON.parse(data.items) : [];

            return (
                <div key={order.id} style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
                    <div style={{display:'flex', justifyContent:'space-between', borderBottom:'1px solid #eee', paddingBottom:'10px'}}>
                        <h3 style={{margin:0}}>Order #{data.order_id}</h3>
                        <span style={{background: data.status==='paid'?'#d1fae5':'#fef3c7', padding:'2px 10px', borderRadius:'10px', fontSize:'0.9rem'}}>
                            {data.status || 'Pending'}
                        </span>
                    </div>

                    <div style={{marginTop:'15px'}}>
                        <strong>Buyer:</strong> {data.buyer_name}<br/>
                        <strong>Items:</strong>
                        <ul style={{marginTop:'5px', color:'#555'}}>
                            {items.map((i, idx) => <li key={idx}>{i.qty}x {i.name} (Rp {i.price})</li>)}
                        </ul>
                        <strong>Total:</strong> Rp {data.total_price?.toLocaleString()}
                    </div>

                    {/* MAP VIEWER */}
                    {location && location.lat && (
                        <div style={{marginTop:'20px'}}>
                            <h4>📍 {location.type === 'home_service' ? 'Service Location' : 'Delivery Destination'}</h4>
                            <p style={{fontSize:'0.9rem', color:'#666'}}>Note: {location.address_note}</p>
                            
                            <div style={{height:'200px', width:'100%', border:'1px solid #ddd', borderRadius:'8px', overflow:'hidden'}}>
                                {/* We can reuse MapPicker in "View Mode" or link to Google Maps */}
                                <iframe 
                                    width="100%" 
                                    height="100%" 
                                    frameBorder="0" 
                                    style={{border:0}} 
                                    src={`https://maps.google.com/maps?q=${location.lat},${location.lng}&z=15&output=embed`}
                                ></iframe>
                            </div>
                            <a 
                                href={`https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`} 
                                target="_blank"
                                style={{display:'block', marginTop:'10px', color:'#2563eb', fontWeight:'bold'}}
                            >
                                Open in Google Maps &rarr;
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