"use client";
import { useEffect, useState } from 'react';
import axios from 'axios';
import dynamic from 'next/dynamic';
import Link from 'next/link';

// Dynamically import map to view location
const MapViewer = dynamic(() => import('@/components/MapViewer'), { ssr: false });

const safeParseJSON = (data, fallback) => {
  if (!data) return fallback;
  if (typeof data === 'object') return data; 
  try {
    return JSON.parse(data);
  } catch (e) {
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
            { headers: { Authorization: `Bearer ${token}` } }
        );
        setOrders(res.data.data);
    } catch (err) {
        console.error("Error fetching orders:", err);
    } finally {
        setLoading(false);
    }
  };

  // ==========================================
  // NEW: FUNCTION TO UPDATE STATUS IN STRAPI
  // ==========================================
  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      const token = localStorage.getItem('token');
      // Use documentId if using Strapi v5, otherwise use id
      await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/api/orders/${orderId}`, {
        data: { order_status: newStatus }
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Update the local state so the UI changes instantly without refreshing
      setOrders(prevOrders => prevOrders.map(order => {
        const idMatch = order.documentId || order.id;
        if (idMatch === orderId) {
          // Update depending on how Strapi returns your data structure
          if (order.attributes) {
            return { ...order, attributes: { ...order.attributes, order_status: newStatus } };
          }
          return { ...order, order_status: newStatus };
        }
        return order;
      }));
      
      alert(`Order status updated to: ${newStatus}`);
    } catch (error) {
      console.error("Failed to update status:", error);
      alert("Failed to update status. Please make sure you enabled 'update' permissions in Strapi.");
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
            // Get the correct ID for the PUT request
            const updateId = order.documentId || order.id; 
            
            const location = safeParseJSON(data.delivery_location, null);
            const items = safeParseJSON(data.items, []);

            // Handle current status safely
            const currentStatus = data.order_status || "Pending";

            return (
                <div key={updateId} style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid #eee', paddingBottom:'10px'}}>
                        <h3 style={{margin:0}}>Order #{data.order_id}</h3>
                        
                        {/* --- NEW: STATUS DROPDOWN --- */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <label style={{fontWeight: 'bold', fontSize: '0.9rem'}}>Status:</label>
                          <select 
                            value={currentStatus}
                            onChange={(e) => handleUpdateStatus(updateId, e.target.value)}
                            style={{
                              padding: '8px', 
                              borderRadius: '6px', 
                              border: '1px solid #ccc',
                              fontWeight: 'bold',
                              background: currentStatus === 'Completed' ? '#d1fae5' : '#fef3c7',
                              color: currentStatus === 'Completed' ? '#065f46' : '#92400e',
                              cursor: 'pointer'
                            }}
                          >
                            <option value="Pending">Pending</option>
                            <option value="Processing">Processing</option>
                            <option value="Ready to Ship">Ready to Ship</option>
                            <option value="Shipped">Shipped</option>
                            <option value="Completed">Completed</option>
                          </select>
                        </div>
                    </div>

                    <div style={{marginTop:'15px'}}>
                        <strong>Buyer Name:</strong> {data.buyer_name}<br/>
                        <strong>Items Purchased:</strong>
                        <ul style={{marginTop:'5px', color:'#374151', background:'#f9fafb', padding:'10px 10px 10px 30px', borderRadius:'6px'}}>
                            {Array.isArray(items) && items.map((i, idx) => (
                                <li key={idx} style={{marginBottom:'5px'}}>
                                    <b>{i.qty || i.quantity}x</b> {i.name} — Rp {i.price?.toLocaleString()}
                                </li>
                            ))}
                        </ul>
                        <div style={{fontSize:'1.1rem', marginTop:'10px'}}>
                            <strong>Total Earned:</strong> <span style={{color:'#B12704'}}>Rp {data.total_price?.toLocaleString()}</span>
                        </div>
                    </div>

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
                            <a 
                                href={`http://googleusercontent.com/maps.google.com/?q=${location.lat},${location.lng}`} 
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