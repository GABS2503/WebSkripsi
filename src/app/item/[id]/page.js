"use client";
import { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Script from 'next/script';
import ProductReviews from '@/components/ProductReviews'; // <--- 1. NEW IMPORT

export default function ItemDetails() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  
  const id = params?.id; 
  const type = searchParams.get('type') || 'product'; 

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [quantity, setQuantity] = useState(1);
  const [selectedVariants, setSelectedVariants] = useState({}); 
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        const endpoint = type === 'product' ? 'products' : 'services';
        const token = localStorage.getItem('token');
        const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
        
        // Fetch item details (using direct ID for "Get One" endpoint)
        const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/${endpoint}/${id}?populate=*`, config);
        
        console.log("Full Item Data:", res.data.data);
        setItem(res.data.data);
      } catch (error) {
        console.error("Error loading item", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, type]);

  const handleVariantSelect = (variantName, optionName) => {
    setSelectedVariants(prev => ({ ...prev, [variantName]: optionName }));
  };

  const handleChat = async () => {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      alert("Please login to chat.");
      router.push('/login');
      return;
    }
    const currentUser = JSON.parse(userStr);
    const token = localStorage.getItem('token');

    let sellerId = null;
    let itemName = "Item";

    const extractId = (obj) => obj?.data?.id || obj?.id;

    if (item) {
      if (item.seller) {
        sellerId = extractId(item.seller);
        itemName = item.name;
      }
      else if (item.attributes?.seller) {
        sellerId = extractId(item.attributes.seller);
        itemName = item.attributes.name;
      }
    }

    console.log("Chat Debug -> Found Seller ID:", sellerId);

    if (!sellerId) {
      alert("Error: Could not read Seller ID. Please check console for details.");
      return;
    }

    if (String(currentUser.id) === String(sellerId)) {
      alert("This is your own item!");
      return;
    }

    try {
      const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/conversations`, {
        data: {
          users: [currentUser.id, sellerId],
          itemTitle: itemName
        }
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const convId = res.data.data.documentId || res.data.data.id;
      router.push(`/chat?id=${convId}`);

    } catch (err) {
      console.error(err);
      alert("Could not start chat. Ensure 'Conversation' collection exists.");
    }
  };

  // Replace your existing handleBuy function with this one:
  const handleBuy = async () => {
    const price = item?.price || item?.attributes?.price;
    const name = item?.name || item?.attributes?.name;
    const variantData = item?.variantData || item?.attributes?.variantData || [];

    if (variantData.length > 0) {
      const missing = variantData.find(v => !selectedVariants[v.name]);
      if (missing) {
        alert(`Please select a ${missing.name}`);
        return;
      }
    }

    try {
      const correctId = item.documentId || item.id;

      // 1. Request Payment Token from Backend
      const res = await axios.post('/api/payment', { 
        id: correctId, 
        price: (price * quantity), 
        name: `${name} (x${quantity})`,
        type: type 
      });

      const token = res.data.token;
      if (!token) throw new Error("No token received from backend");

      // 2. Open Snap Popup with Callbacks (THE MISSING PART)
      // @ts-ignore
      window.snap.pay(token, {
        // Callback when payment is successful
        onSuccess: function(result) {
          console.log("Payment Success:", result);
          alert("Payment Successful! Thank you for your purchase.");
          // Optional: Redirect to a success page or clear cart
          // router.push('/order-history'); 
        },
        // Callback when payment is pending (e.g. waiting for Bank Transfer)
        onPending: function(result) {
          console.log("Payment Pending:", result);
          alert("Payment Pending! Please complete the payment via your selected method.");
        },
        // Callback when payment failed
        onError: function(result) {
          console.log("Payment Error:", result);
          alert("Payment Failed. Please try again.");
        },
        // Callback when user closes the popup without finishing
        onClose: function() {
          alert("You closed the payment popup without finishing.");
        }
      });

    } catch (err) {
      console.error("Payment Error:", err);
      const errorMessage = err.response?.data?.error || "Payment Failed";
      alert(`Error: ${errorMessage}`);
    }
  };

  if (loading) return <div className="container" style={{padding:'2rem', textAlign:'center'}}>Loading...</div>;
  if (!item) return <div className="container" style={{padding:'2rem', textAlign:'center'}}>Item not found.</div>;

  const data = item.attributes || item;
  const sellerRaw = data.seller?.data?.attributes || data.seller || {};
  const sellerName = sellerRaw.shopName || sellerRaw.username || "Unknown Seller";
  const variants = data.variantData || [];
  const attributes = data.customAttributes || [];
  const maxStock = data.stock || 999;
  const isOutOfStock = type === 'product' && maxStock < 1;

  const getMediaList = (mediaField) => {
    if (!mediaField) return [];
    const unwrapped = mediaField.data || mediaField;
    const items = Array.isArray(unwrapped) ? unwrapped : [unwrapped];
    return items.map(item => {
      const finalData = item?.attributes || item;
      if (!finalData?.url) return null;
      return {
        id: item.id,
        url: `${process.env.NEXT_PUBLIC_API_URL}${finalData.url}`,
        isVideo: finalData.mime?.startsWith('video/')
      };
    }).filter(Boolean);
  };

  const mediaList = getMediaList(data.media);
  const activeMedia = mediaList[activeImageIndex] || mediaList[0] || null;

  return (
    <div style={{ background: '#f3f4f6', minHeight: '100vh' }}>
      <nav className="navbar">
        <h1 style={{ margin:0 }}>MSME Market</h1>
        <Link href="/" style={{color:'white', textDecoration:'none', fontWeight:'bold'}}>&larr; Back</Link>
      </nav>

      <main className="container" style={{ marginTop: '2rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', background: 'white', padding: '2rem', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          
          {/* LEFT: GALLERY SECTION */}
          <div style={{ flex: '1 1 400px' }}>
            <div style={{ width: '100%', height: '400px', background: 'white', borderRadius: '8px', border: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: '1rem' }}>
              {activeMedia ? (
                 activeMedia.isVideo ? (
                   <video controls src={activeMedia.url} style={{maxWidth:'100%', maxHeight:'100%'}} />
                 ) : (
                   <img src={activeMedia.url} alt={data.name} style={{maxWidth:'100%', maxHeight:'100%', objectFit:'contain'}} />
                 )
              ) : (
                 <div style={{width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:'#666', flexDirection:'column'}}>
                   <span style={{fontSize:'3rem'}}>📷</span>
                   <span>No Media</span>
                 </div>
              )}
            </div>

            {mediaList.length > 1 && (
              <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                {mediaList.map((media, index) => (
                  <div key={index} onClick={() => setActiveImageIndex(index)} style={{width: '60px', height: '60px', borderRadius: '4px', border: activeImageIndex === index ? '2px solid #e77600' : '1px solid #ddd', cursor: 'pointer', overflow: 'hidden', flexShrink: 0}}>
                    {media.isVideo ? <div style={{width:'100%', height:'100%', background:'#000', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.7rem'}}>VID</div> : <img src={media.url} alt="thumb" style={{width:'100%', height:'100%', objectFit:'cover'}} />}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT: DETAILS */}
          <div style={{ flex: '1 1 400px' }}>
            <h1 style={{ marginTop: 0, color: '#111827' }}>{data.name}</h1>
            <p style={{ color: '#007185', fontSize: '0.9rem' }}>
              Sold by: <strong>{sellerName}</strong>
            </p>

            <hr style={{ margin: '1rem 0', borderColor: '#e5e7eb' }} />

            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#B12704' }}>
              Rp {data.price?.toLocaleString()}
            </div>

            <p style={{ lineHeight: '1.6', color: '#374151', whiteSpace: 'pre-line' }}>
              {data.description || "No description provided."}
            </p>

            {/* ATTRIBUTES */}
            {attributes.length > 0 && (
              <div style={{ margin: '1.5rem 0' }}>
                <h4 style={{ marginBottom: '0.5rem' }}>Specifications:</h4>
                <table style={{ width: '100%', fontSize: '0.9rem', borderCollapse: 'collapse' }}>
                  <tbody>
                    {attributes.map((attr, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #eee' }}><td style={{ padding: '8px', fontWeight: 'bold', color: '#555', width: '40%' }}>{attr.key}</td><td style={{ padding: '8px' }}>{attr.value}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* VARIANTS */}
            {variants.map((variant, i) => (
              <div key={i} style={{ marginBottom: '1rem' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>{variant.name}: <span style={{fontWeight:'normal'}}>{selectedVariants[variant.name]}</span></div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {variant.options.map((option, idx) => {
                    const isObject = typeof option === 'object' && option !== null;
                    const name = isObject ? option.name : option;
                    const image = isObject ? option.image : null;
                    const isSelected = selectedVariants[variant.name] === name;
                    return (
                      <button key={idx} onClick={() => handleVariantSelect(variant.name, name)} style={{padding: '0.5rem 1rem', border: isSelected ? '2px solid #e77600' : '1px solid #d1d5db', background: isSelected ? '#fff4e3' : 'white', borderRadius: '4px', cursor: 'pointer', fontWeight: isSelected ? 'bold' : 'normal', display: 'flex', alignItems: 'center', gap: '8px'}}>
                        {image && <img src={`${process.env.NEXT_PUBLIC_API_URL}${image.url}`} alt={name} style={{width:'24px', height:'24px', objectFit:'cover', borderRadius:'4px', border:'1px solid #eee'}} />}
                        {name}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}

            {/* ACTION BUTTONS */}
            <div style={{ marginTop: '2rem', padding: '1.5rem', border: '1px solid #d1d5db', borderRadius: '8px', background: '#f9fafb' }}>
              {isOutOfStock ? (
                <h3 style={{ color: '#ef4444', marginTop:0 }}>Currently Unavailable</h3>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                    <span style={{ fontWeight: 'bold' }}>Quantity:</span>
                    <select value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}>
                      {[...Array(Math.min(10, type === 'product' ? maxStock : 10)).keys()].map(n => <option key={n+1} value={n+1}>{n+1}</option>)}
                    </select>
                  </div>
                  {type === 'product' && <div style={{ color: '#166534', fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '1rem' }}>{maxStock > 10 ? 'In Stock' : `Only ${maxStock} left in stock - order soon`}</div>}

                  <button onClick={handleChat} style={{ width: '100%', borderRadius: '20px', padding: '0.8rem', background: 'white', border: '1px solid #d1d5db', marginBottom: '0.8rem', cursor: 'pointer', fontWeight: 'bold', color: '#333' }}>Chat with Seller</button>
                  <button onClick={handleBuy} className="btn-primary" style={{ width: '100%', borderRadius: '20px', padding: '0.8rem' }}>Buy Now</button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* --- 2. NEW REVIEWS SECTION --- */}
        {/* We prefer documentId for v5 filtering, fallback to id for v4 */}
        <ProductReviews itemId={item.documentId || item.id} itemType={type} />

      </main>

      {/* --- SCRIPT TAG --- */}
      <Script 
        src="https://app.sandbox.midtrans.com/snap/snap.js"
        data-client-key="SB-Mid-client-5Palqn_HYf6iXJ0n"
        strategy="lazyOnload" 
      />
    </div>
  );
}