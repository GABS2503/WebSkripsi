"use client";
import { useCart } from '@/context/CartContext';
import { useState, useEffect } from 'react';
import axios from 'axios';
import Script from 'next/script';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function CartPage() {
  const { cart, removeFromCart } = useCart();
  const [groupedItems, setGroupedItems] = useState({});
  const [activeClientKey, setActiveClientKey] = useState("");
  const router = useRouter();

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
      // 1. Create transaction token from your Next.js backend
      const res = await axios.post('/api/payment', { 
        id: `CART-${Date.now()}`, 
        price: totalAmount, 
        name: orderName,
        type: 'cart_checkout',
        details: items
      });

      const token = res.data.token;

      // 2. Trigger Snap Popup
      setTimeout(() => {
        // @ts-ignore
        if (window.snap) {
          window.snap.pay(token, {
           onSuccess: async function(result) {
              try {
                const userToken = localStorage.getItem('token'); 
                
                const storedUserStr = localStorage.getItem('user');
                const loggedInUser = storedUserStr ? JSON.parse(storedUserStr) : null;
                const finalBuyerName = loggedInUser ? loggedInUser.username : (items[0]?.customerInfo?.name || "Guest");
                
                const locationData = items[0]?.customerInfo?.location || items[0]?.customerInfo || {};
                const formattedSellerId = isNaN(sellerId) ? sellerId : Number(sellerId);

                // Re-added the payload to create the order!
                const payload = {
                  data: {
                    order_id: result.order_id, 
                    total_price: totalAmount,
                    buyer_name: finalBuyerName, 
                    seller: formattedSellerId,
                    items: JSON.stringify(items),
                    delivery_location: JSON.stringify(locationData),
                    order_status: "paid", 
                    publishedAt: new Date().toISOString() 
                  }
                };

                const headers = userToken ? { Authorization: `Bearer ${userToken}` } : {};

                // Send order to Strapi
                await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/orders`, payload, { headers });

                alert("Payment Success! Order sent to seller.");
                
                // Clear the cart and redirect
                items.forEach(i => removeFromCart(i.uniqueId));
                router.push('/account');

              } catch (error) {
                console.error("Error saving order:", error);
                alert("Payment was successful, but there was an error saving the order.");
              }
            },

  const grandTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  return (
    <div style={{ background: '#f3f4f6', minHeight: '100vh', padding: '2rem' }}>
      <div className="container" style={{maxWidth:'800px', margin:'0 auto'}}>
        
        {/* --- BACK BUTTON --- */}
        <div style={{ marginBottom: '1.5rem' }}>
            <Link href="/" style={{ textDecoration: 'none', color: '#374151', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '1.1rem' }}>
                <span>&larr;</span> Continue Shopping
            </Link>
        </div>

        <h1 style={{marginBottom:'2rem', fontSize:'2rem'}}>Your Cart</h1>
        
        {cart.length === 0 ? (
          <div style={{textAlign:'center', padding:'4rem', background:'white', borderRadius:'8px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)'}}>
            <h3 style={{color:'#6b7280', marginBottom:'1rem'}}>Your cart is empty.</h3>
            <Link href="/" className="btn-primary" style={{ textDecoration:'none', display:'inline-block', padding:'10px 20px', borderRadius:'6px' }}>
                Start Shopping
            </Link>
          </div>
        ) : (
          <>
            <div style={{background:'white', padding:'20px', borderRadius:'8px', marginBottom:'2rem', textAlign:'right', border:'1px solid #ddd'}}>
              <h3>Grand Total: <span style={{color:'#B12704'}}>Rp {grandTotal.toLocaleString()}</span></h3>
            </div>

            {Object.entries(groupedItems).map(([sellerId, group]) => (
              <div key={sellerId} style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                <div style={{borderBottom:'1px solid #eee', paddingBottom:'10px', marginBottom:'1rem'}}>
                  <h3 style={{margin:0, color:'#111827'}}>Store: {group.sellerName}</h3>
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
                      {/* Show customer name/address if available */}
                      {item.customerInfo && (
                          <div style={{fontSize:'0.85rem', color:'#555', marginTop:'4px'}}>
                            For: {item.customerInfo.name}
                          </div>
                      )}
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontWeight:'bold', color:'#B12704'}}>Rp {(item.price * item.quantity).toLocaleString()}</div>
                      <button onClick={() => removeFromCart(item.uniqueId)} style={{color:'red', background:'none', border:'none', cursor:'pointer', fontSize:'0.8rem', marginTop:'10px', textDecoration:'underline'}}>Remove</button>
                    </div>
                  </div>
                ))}

                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'1.5rem', paddingTop:'1rem', borderTop:'1px solid #eee' }}>
                  <div>
                      <span style={{color:'#666'}}>Subtotal:</span><br/>
                      <strong style={{fontSize:'1.2rem'}}>Rp {group.items.reduce((s, i)=>s+(i.price*i.quantity),0).toLocaleString()}</strong>
                  </div>
                  <button 
                      onClick={() => handlePaySeller(sellerId, group)}
                      className="btn-primary"
                      style={{padding:'12px 24px', borderRadius:'6px', fontSize:'1rem'}}
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
