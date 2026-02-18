"use client";
import { useCart } from '@/context/CartContext';
import { useState, useEffect } from 'react';
import axios from 'axios';
import Script from 'next/script';
import Link from 'next/link';

export default function CartPage() {
  const { cart, removeFromCart } = useCart();
  const [groupedItems, setGroupedItems] = useState({});
  const [activeClientKey, setActiveClientKey] = useState("");

  useEffect(() => {
    const groups = {};
    cart.forEach(item => {
      // Handle both v4 (id) and v5 (documentId) seller structures
      const sellerId = item.seller?.id || item.seller?.documentId || 'unknown';
      
      if (!groups[sellerId]) {
        groups[sellerId] = {
          sellerName: item.seller?.shopName || item.seller?.username || 'Unknown Shop',
          clientKey: item.seller?.midtransClientKey || item.seller?.midtrans_client_key,
          items: []
        };
      }
      groups[sellerId].items.push(item);
    });
    setGroupedItems(groups);
  }, [cart]);

  const handlePaySeller = async (sellerId, groupData) => {
    const { items, clientKey } = groupData;
    
    if (!clientKey) {
      alert("This seller currently cannot accept payments (Missing Key).");
      return;
    }

    setActiveClientKey(clientKey);

    const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const orderName = `Order from ${groupData.sellerName} (${items.length} items)`;

    try {
      // --- HERE IS THE FIX: Ensure type is EXACTLY 'cart_checkout' ---
      const res = await axios.post('/api/payment', { 
        id: `CART-${Date.now()}`, 
        price: totalAmount, 
        name: orderName,
        type: 'cart_checkout', // <--- THIS IS CRITICAL
        details: items // Send the items so backend can list them
      });

      const token = res.data.token;

      setTimeout(() => {
        // @ts-ignore
        if (window.snap) {
          window.snap.pay(token, {
            onSuccess: function(result) {
              alert("Payment Success!");
              items.forEach(i => removeFromCart(i.uniqueId));
            },
            onPending: function(result) { alert("Waiting for payment..."); },
            onError: function(result) { alert("Payment failed"); }
          });
        }
      }, 500);

    } catch (err) {
      console.error(err);
      // Alert the exact error from backend
      alert(err.response?.data?.error || "Payment initiation failed.");
    }
  };

  const grandTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  return (
    <div style={{ background: '#f3f4f6', minHeight: '100vh', padding: '2rem' }}>
      <div className="container" style={{maxWidth:'800px', margin:'0 auto'}}>
        <h1 style={{marginBottom:'2rem'}}>Your Cart</h1>
        
        {cart.length === 0 ? (
          <div style={{textAlign:'center', padding:'3rem', background:'white', borderRadius:'8px'}}>
            <h3>Your cart is empty.</h3>
            <Link href="/" style={{color:'#2563eb', fontWeight:'bold'}}>Go Shopping &rarr;</Link>
          </div>
        ) : (
          <>
            <div style={{background:'white', padding:'20px', borderRadius:'8px', marginBottom:'2rem', textAlign:'right', border:'1px solid #ddd'}}>
              <h3>Grand Total: <span style={{color:'#B12704'}}>Rp {grandTotal.toLocaleString()}</span></h3>
            </div>

            {Object.entries(groupedItems).map(([sellerId, group]) => (
              <div key={sellerId} style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                <div style={{borderBottom:'1px solid #eee', paddingBottom:'10px', marginBottom:'1rem'}}>
                  <h3 style={{margin:0}}>Store: {group.sellerName}</h3>
                </div>

                {group.items.map((item) => (
                  <div key={item.uniqueId} style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', borderBottom: '1px solid #f9f9f9', paddingBottom: '1rem' }}>
                    <img src={item.image} style={{width:'80px', height:'80px', objectFit:'cover', borderRadius:'4px', background:'#eee'}} />
                    <div style={{flex:1}}>
                      <h4 style={{margin:0, fontSize:'1.1rem'}}>{item.name}</h4>
                      <div style={{color:'#666', fontSize:'0.9rem', margin:'5px 0'}}>
                          {item.type.toUpperCase()} | Qty: {item.quantity} 
                      </div>
                      <div style={{fontSize:'0.85rem', color:'#059669', background:'#ecfdf5', display:'inline-block', padding:'2px 8px', borderRadius:'4px'}}>
                          Option: <b>{item.selectedOptions?.deliveryType || "Standard"}</b>
                      </div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontWeight:'bold', color:'#B12704'}}>Rp {(item.price * item.quantity).toLocaleString()}</div>
                      <button onClick={() => removeFromCart(item.uniqueId)} style={{color:'red', background:'none', border:'none', cursor:'pointer', fontSize:'0.8rem', marginTop:'10px', textDecoration:'underline'}}>Remove</button>
                    </div>
                  </div>
                ))}

                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'1.5rem', paddingTop:'1rem', borderTop:'1px solid #eee' }}>
                  <div>
                      <span>Subtotal:</span><br/>
                      <strong style={{fontSize:'1.2rem'}}>Rp {group.items.reduce((s, i)=>s+(i.price*i.quantity),0).toLocaleString()}</strong>
                  </div>
                  <button 
                      onClick={() => handlePaySeller(sellerId, group)}
                      className="btn-primary"
                      style={{padding:'10px 20px', borderRadius:'6px'}}
                  >
                      Checkout {group.items.length} Items
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {activeClientKey && (
        <Script 
          src="https://app.sandbox.midtrans.com/snap/snap.js"
          data-client-key={activeClientKey}
          strategy="lazyOnload"
        />
      )}
    </div>
  );
}
