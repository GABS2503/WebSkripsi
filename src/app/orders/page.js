"use client";
import { useEffect, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';

const safeParseJSON = (data, fallback) => {
  if (!data) return fallback;
  if (typeof data === 'object') return data; 
  try { return JSON.parse(data); } catch (e) { return fallback; }
};

export default function BuyerOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchMyOrders = async () => {
      const u = localStorage.getItem('user');
      if (!u) {
        setLoading(false);
        return;
      }
      
      const userData = JSON.parse(u);
      setUser(userData);
      const token = localStorage.getItem('token');

      try {
        // Fetch orders where the buyer_name matches the logged-in user
        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/api/orders?filters[buyer_name][$eq]=${userData.username}&sort=createdAt:desc`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setOrders(res.data.data);
      } catch (err) {
        console.error("Failed to fetch buyer orders", err);
      } finally {
        setLoading(false);
      }
    };

    fetchMyOrders();
  }, []);

  if (loading) return <div style={{padding:'2rem'}}>Loading your orders...</div>;

  if (!user) {
    return (
      <div style={{padding:'4rem', textAlign:'center'}}>
        <h2>Please log in to track your orders.</h2>
        <Link href="/login" style={{color:'#2563eb', textDecoration:'underline'}}>Go to Login</Link>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', background: '#f9fafb', minHeight: '100vh' }}>
      <div style={{maxWidth: '800px', margin: '0 auto'}}>
        <Link href="/" style={{display:'block', marginBottom:'20px', color:'#2563eb', fontWeight:'bold'}}>← Back to Store</Link>
        <h1 style={{marginBottom:'2rem'}}>My Orders Tracking</h1>

        {orders.length === 0 ? (
          <div style={{background:'white', padding:'3rem', borderRadius:'8px', textAlign:'center', boxShadow:'0 1px 3px rgba(0,0,0,0.1)'}}>
            <p style={{color:'#6b7280', fontSize:'1.1rem'}}>You haven't placed any orders yet.</p>
          </div>
        ) : (
          <div style={{display:'flex', flexDirection:'column', gap:'20px'}}>
            {orders.map(order => {
              const data = order.attributes || order;
              const items = safeParseJSON(data.items, []);
              
              // Visual tracking logic
              const statusList = ['Pending', 'Processing', 'Ready to Ship', 'Shipped', 'Completed'];
              const currentStatus = data.order_status || 'Pending';
              const currentIndex = statusList.indexOf(currentStatus);

              return (
                <div key={order.id || order.documentId} style={{background:'white', padding:'20px', borderRadius:'8px', boxShadow:'0 2px 5px rgba(0,0,0,0.05)'}}>
                  <div style={{display:'flex', justifyContent:'space-between', borderBottom:'1px solid #eee', paddingBottom:'10px', marginBottom:'15px'}}>
                    <h3 style={{margin:0}}>Order #{data.order_id}</h3>
                    <h3 style={{margin:0, color:'#B12704'}}>Rp {data.total_price?.toLocaleString()}</h3>
                  </div>

                  {/* Status Progress Bar */}
                  <div style={{marginBottom:'20px', padding:'15px', background:'#f8fafc', borderRadius:'8px'}}>
                    <h4 style={{margin:'0 0 10px 0'}}>Current Status: <span style={{color:'#2563eb'}}>{currentStatus}</span></h4>
                    
                    <div style={{display:'flex', justifyContent:'space-between', fontSize:'0.8rem', color:'#64748b', position:'relative'}}>
                      {statusList.map((step, index) => (
                        <div key={step} style={{textAlign:'center', flex:1, zIndex:2}}>
                          <div style={{
                            width:'20px', height:'20px', borderRadius:'50%', margin:'0 auto 5px auto',
                            background: index <= currentIndex ? '#2563eb' : '#cbd5e1',
                            color: 'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'10px'
                          }}>
                            {index <= currentIndex ? '✓' : ''}
                          </div>
                          <span style={{fontWeight: index <= currentIndex ? 'bold' : 'normal', color: index <= currentIndex ? '#0f172a' : '#94a3b8'}}>{step}</span>
                        </div>
                      ))}
                      {/* Connecting line behind circles */}
                      <div style={{position:'absolute', top:'10px', left:'10%', right:'10%', height:'2px', background:'#e2e8f0', zIndex:1}} />
                    </div>
                  </div>

                  <div>
                    <strong style={{color:'#475569'}}>Items in this order:</strong>
                    <ul style={{margin:'10px 0 0 0', paddingLeft:'20px', color:'#334155'}}>
                      {items.map((i, idx) => (
                        <li key={idx}><b>{i.qty || i.quantity}x</b> {i.name}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}