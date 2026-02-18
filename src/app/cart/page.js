// src/app/cart/page.js
"use client";
import { useCart } from '@/context/CartContext';
import { useState, useEffect } from 'react';
import axios from 'axios';
import Script from 'next/script';
import Link from 'next/link';

export default function CartPage() {
  const { cart, removeFromCart, clearCart } = useCart();
  const [groupedItems, setGroupedItems] = useState({});
  
  // State to track which Seller's Key to load currently
  const [activeClientKey, setActiveClientKey] = useState("");

  // Group items by Seller ID when cart changes
  useEffect(() => {
    const groups = {};
    cart.forEach(item => {
      const sellerId = item.seller?.id || 'unknown';
      if (!groups[sellerId]) {
        groups[sellerId] = {
          sellerName: item.seller?.shopName || item.seller?.username || 'Unknown Shop',
          clientKey: item.seller?.midtransClientKey, // Get the dynamic key
          items: []
        };
      }
      groups[sellerId].items.push(item);
    });
    setGroupedItems(groups);
  }, [cart]);

  // Handle Payment for a specific Seller Group
  const handlePaySeller = async (sellerId, groupData) => {
    const { items, clientKey } = groupData;
    
    if (!clientKey) {
      alert("This seller has not set up payments yet.");
      return;
    }

    // Set the active key so the Script tag updates
    setActiveClientKey(clientKey);

    // Calculate total for this seller
    const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Create a composite name for the order
    const orderName = `Order from ${groupData.sellerName} (${items.length} items)`;

    try {
      // 1. Get Token from Backend
      // We send a generic ID (like 0) because this is a custom cart order
      // You might need to update your backend to handle "custom" carts or just send the first item's ID
      const res = await axios.post('/api/payment', { 
        id: "cart_order", // Dummy ID
        price: totalAmount, 
        name: orderName,
        type: 'cart',
        // Optional: Send full breakdown to backend if you update backend to support it
        details: items 
      });

      const token = res.data.token;

      // 2. Trigger Snap
      // We give a short delay to ensure the Client Key Script has loaded
      setTimeout(() => {
        if (window.snap) {
          window.snap.pay(token, {
            onSuccess: function(result) {
              alert("Payment Success!");
              // Remove these specific items from cart
              items.forEach(i => removeFromCart(i.uniqueId));
            },
            onPending: function(result) { alert("Waiting for payment..."); },
            onError: function(result) { alert("Payment failed"); }
          });
        }
      }, 500);

    } catch (err) {
      console.error(err);
      alert("Payment initiation failed.");
    }
  };

  const grandTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  return (
    <div style={{ background: '#f3f4f6', minHeight: '100vh', padding: '2rem' }}>
      <h1>Your Cart</h1>
      
      {cart.length === 0 ? (
        <p>Your cart is empty. <Link href="/">Go Shopping</Link></p>
      ) : (
        <div style={{maxWidth: '800px', margin: '0 auto'}}>
          
          <div style={{background:'white', padding:'20px', borderRadius:'8px', marginBottom:'2rem', textAlign:'right'}}>
            <h3>Grand Total: <span style={{color:'#B12704'}}>Rp {grandTotal.toLocaleString()}</span></h3>
          </div>

          {/* Render Groups */}
          {Object.entries(groupedItems).map(([sellerId, group]) => (
            <div key={sellerId} style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem', border: '1px solid #ddd' }}>
              <h3 style={{borderBottom:'1px solid #eee', paddingBottom:'10px'}}>
                Store: {group.sellerName}
              </h3>

              {group.items.map((item) => (
                <div key={item.uniqueId} style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', borderBottom: '1px solid #f0f0f0', paddingBottom: '1rem' }}>
                  <img src={item.image} style={{width:'80px', height:'80px', objectFit:'cover', borderRadius:'4px'}} />
                  <div style={{flex:1}}>
                    <h4 style={{margin:0}}>{item.name}</h4>
                    <p style={{color:'#666', fontSize:'0.9rem', margin:'5px 0'}}>
                        {item.type} | Qty: {item.quantity} | 
                        <b> Option: {item.selectedOptions.deliveryType}</b>
                    </p>
                    <p style={{fontSize:'0.85rem', color:'#555'}}>
                        Info: {item.customerInfo.name} 
                        {item.customerInfo.address && ` - ${item.customerInfo.address}`}
                    </p>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontWeight:'bold'}}>Rp {(item.price * item.quantity).toLocaleString()}</div>
                    <button onClick={() => removeFromCart(item.uniqueId)} style={{color:'red', background:'none', border:'none', cursor:'pointer', fontSize:'0.8rem'}}>Remove</button>
                  </div>
                </div>
              ))}

              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'1rem' }}>
                <div>
                    <strong>Subtotal: Rp {group.items.reduce((s, i)=>s+(i.price*i.quantity),0).toLocaleString()}</strong>
                </div>
                <button 
                    onClick={() => handlePaySeller(sellerId, group)}
                    className="btn-primary"
                    style={{padding:'10px 20px', borderRadius:'6px'}}
                >
                    Checkout from {group.sellerName}
                </button>
              </div>
            </div>
          ))}

        </div>
      )}

      {/* DYNAMIC SCRIPT LOADER */}
      {/* This loads the Midtrans script for the specific seller you are currently paying */}
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