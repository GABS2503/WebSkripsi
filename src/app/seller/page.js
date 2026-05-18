"use client";
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// --- DYNAMIC IMPORT FOR MAP ---
const MapPicker = dynamic(() => import('@/components/MapPicker'), { ssr: false });

export default function SellerDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('product');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [myItems, setMyItems] = useState([]);
  const [editingId, setEditingId] = useState(null); 
  const [allItemsForLive, setAllItemsForLive] = useState([]); 

  // --- FIXED: Added isPromo and promoPrice to state ---
  const [formData, setFormData] = useState({ name: '', price: '', category: '', description: '', stock: '', title: '', streamUrl: '', selectedItemId: '', isPromo: false, promoPrice: '' });
  
  const [settingsData, setSettingsData] = useState({
    midtransServerKey: '', midtransClientKey: '', shopDescription: '', shopLocation: { lat: null, lng: null }
  });

  const [variants, setVariants] = useState([]);
  const [attributes, setAttributes] = useState([]);
  const [files, setFiles] = useState([]); 
  const [previews, setPreviews] = useState([]);
  const [newVariantName, setNewVariantName] = useState('');
  const [newVariantOption, setNewVariantOption] = useState('');

  const PRODUCT_CATS = ["Food & Beverage", "Fashion (Men)", "Fashion (Women)", "Electronics", "Handicrafts", "Furniture", "Health & Beauty", "Toys & Hobbies", "Automotive"];
  const SERVICE_CATS = ["Electronics Repair", "House Cleaning", "Massage/Spa", "Tutoring", "Graphic Design", "Laundry", "Catering", "Consulting", "Transport"];
  const currentCategories = activeTab === 'product' ? PRODUCT_CATS : SERVICE_CATS;

  const fetchMyItems = useCallback(async () => {
    if (activeTab === 'settings') return;
    const userStr = localStorage.getItem('user'); 
    const token = localStorage.getItem('token');
    if (!userStr || !token) return;
    
    const user = JSON.parse(userStr); 
    const endpoint = activeTab === 'product' ? 'products' : activeTab === 'service' ? 'services' : 'livestreams';
    
    try {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/${endpoint}?filters[seller][id][$eq]=${user.id}&populate=*&sort=createdAt:desc`, { headers: { Authorization: `Bearer ${token}` } });
      
      const normalizedItems = res.data.data.map(item => {
        const itemData = item.attributes || item;
        return { ...itemData, _id: item.id, _documentId: item.documentId, id: item.documentId || item.id };
      });
      setMyItems(normalizedItems);

      if (activeTab === 'livestream') {
        const [prodRes, servRes] = await Promise.all([ 
          axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/products?filters[seller][id][$eq]=${user.id}`, { headers: { Authorization: `Bearer ${token}` } }), 
          axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/services?filters[seller][id][$eq]=${user.id}`, { headers: { Authorization: `Bearer ${token}` } }) 
        ]);
        
        setAllItemsForLive([
          ...prodRes.data.data.map(i => {
             const d = i.attributes || i;
             return { id: i.documentId || i.id, name: d.name, type: 'product' };
          }), 
          ...servRes.data.data.map(i => {
             const d = i.attributes || i;
             return { id: i.documentId || i.id, name: d.name, type: 'service' };
          })
        ]);
      }
    } catch (err) { 
      console.error("Failed to fetch items", err); 
    }
  }, [activeTab]);

  useEffect(() => {
    const token = localStorage.getItem('token'); const userStr = localStorage.getItem('user');
    if (!token || !userStr) { router.push('/login'); } else {
      const user = JSON.parse(userStr);
      if (user.isSeller) {
        setIsLoading(false);
        let savedLoc = { lat: null, lng: null };
        try { if(user.shopLocation) savedLoc = typeof user.shopLocation === 'string' ? JSON.parse(user.shopLocation) : user.shopLocation; } catch(e){}
        setSettingsData({ midtransServerKey: user.midtransServerKey || '', midtransClientKey: user.midtransClientKey || '', shopDescription: user.shopDescription || '', shopLocation: savedLoc });
        resetForm(activeTab); fetchMyItems(); 
      } else { alert("Access Denied."); router.push('/'); }
    }
  }, [router, activeTab, fetchMyItems]);

  const resetForm = (tab) => {
    setEditingId(null); 
    setFormData({ 
      name: '', price: '', description: '', stock: '', title: '', streamUrl: '', selectedItemId: '', 
      isPromo: false, promoPrice: '', // <-- Reset promo fields
      category: tab === 'livestream' ? '' : (tab === 'product' ? PRODUCT_CATS[0] : SERVICE_CATS[0]) 
    });
    setVariants([]); setAttributes([]); setFiles([]); setPreviews([]); setIsCustomCategory(false); setNewVariantName(''); setNewVariantOption('');
  };

  const handleEdit = (item) => {
    setEditingId(item._documentId || item.id); window.scrollTo({ top: 0, behavior: 'smooth' });
    if (activeTab === 'livestream') { setFormData({ title: item.title, streamUrl: item.streamUrl, selectedItemId: '' }); } else {
      
      const isCatCustom = !currentCategories.includes(item.category);
      setIsCustomCategory(isCatCustom);
      
      setFormData({ 
          name: item.name, 
          price: item.price, 
          description: item.description, 
          stock: item.stock || 0, 
          category: item.category || currentCategories[0], 
          isPromo: item.isPromo || false,      // <-- Load promo status
          promoPrice: item.promoPrice || '',   // <-- Load promo price
          title: '', 
          streamUrl: '' 
      });
      setVariants(item.variantData || []); setAttributes(item.customAttributes || []);
      const mediaArray = Array.isArray(item.media?.data || item.media) ? (item.media?.data || item.media) : [(item.media?.data || item.media)];
      setPreviews(mediaArray.map(m => m?.attributes?.url || m?.url ? `${process.env.NEXT_PUBLIC_API_URL}${m.attributes?.url || m.url}` : null).filter(Boolean)); setFiles([]); 
    }
  };

  const handleDelete = async (id) => {
    if(!confirm("Are you sure you want to delete this listing?")) return;
    try { await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/api/${activeTab === 'product' ? 'products' : activeTab === 'service' ? 'services' : 'livestreams'}/${id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }); alert("Deleted successfully"); fetchMyItems(); if(editingId === id) resetForm(activeTab); } catch (err) { alert("Failed to delete."); }
  };

  const addVariantType = () => { if (!newVariantName.trim()) return; setVariants([...variants, { name: newVariantName, options: [] }]); setNewVariantName(''); };
  const addVariantOption = (vIdx) => { if (!newVariantOption.trim()) return; const v = [...variants]; v[vIdx].options.push({ name: newVariantOption, file: null, previewUrl: null, image: null }); setVariants(v); setNewVariantOption(''); };
  const handleVariantImageUpload = (e, vIdx, oIdx) => { const file = e.target.files[0]; if (!file) return; const v = [...variants]; v[vIdx].options[oIdx].file = file; v[vIdx].options[oIdx].previewUrl = URL.createObjectURL(file); setVariants(v); };
  const removeVariantType = (idx) => setVariants(variants.filter((_, i) => i !== idx));
  const removeVariantOption = (vIdx, oIdx) => { const v = [...variants]; v[vIdx].options = v[vIdx].options.filter((_, i) => i !== oIdx); setVariants(v); };
  const addAttribute = () => setAttributes([...attributes, { key: '', value: '' }]);
  const updateAttribute = (idx, field, value) => { const a = [...attributes]; a[idx][field] = value; setAttributes(a); };
  const removeAttribute = (idx) => setAttributes(attributes.filter((_, i) => i !== idx));
  
  const handleCategoryChange = (e) => { 
    const value = e.target.value; 
    if (value === 'custom_option') { 
        setIsCustomCategory(true); 
        setFormData({ ...formData, category: '' }); 
    } else { 
        setIsCustomCategory(false); 
        setFormData({ ...formData, category: value }); 
    } 
  };
  
  const handleMainMediaChange = (e) => { if (e.target.files) { const newFiles = Array.from(e.target.files); setFiles(prev => [...prev, ...newFiles]); setPreviews(prev => [...prev, ...newFiles.map(file => URL.createObjectURL(file))]); } };
  const removeImage = (index) => { setFiles(prev => prev.filter((_, i) => i !== index)); setPreviews(prev => prev.filter((_, i) => i !== index)); };

  const handleLocationChange = useCallback((loc) => {
    setSettingsData(prev => ({ ...prev, shopLocation: loc }));
  }, []);

  const handleSaveSettings = async (e) => {
    e.preventDefault(); setIsSubmitting(true);
    const token = localStorage.getItem('token'); const user = JSON.parse(localStorage.getItem('user'));
    if(!settingsData.shopLocation.lat) { alert("Please pin your store location on the map before saving."); setIsSubmitting(false); return; }
    try {
      const res = await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/api/users/${user.id}`, { midtransServerKey: settingsData.midtransServerKey, midtransClientKey: settingsData.midtransClientKey, shopDescription: settingsData.shopDescription, shopLocation: settingsData.shopLocation }, { headers: { Authorization: `Bearer ${token}` } });
      const updatedUser = { ...user, ...res.data }; localStorage.setItem('user', JSON.stringify(updatedUser)); alert("Settings successfully saved!");
    } catch (err) { alert("Failed to save settings. Please try again."); } finally { setIsSubmitting(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setIsSubmitting(true);
    const token = localStorage.getItem('token'); const user = JSON.parse(localStorage.getItem('user'));
    try {
      let mediaIds = []; 
      if (files.length > 0) {
        const uploadData = new FormData(); files.forEach((f) => { uploadData.append('files', f); });
        const uploadRes = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/upload`, uploadData, { headers: { Authorization: `Bearer ${token}` } });
        mediaIds = uploadRes.data.map(file => file.id);
      }

      const processedVariants = await Promise.all(variants.map(async (variant) => {
        const processedOptions = await Promise.all(variant.options.map(async (option) => {
          let imageData = option.image; 
          if (option.file) {
            const variantUploadData = new FormData(); variantUploadData.append('files', option.file);
            try { const uploadRes = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/upload`, variantUploadData, { headers: { Authorization: `Bearer ${token}` } }); imageData = { id: uploadRes.data[0].id, url: uploadRes.data[0].url }; } catch (err) { console.error("Failed to upload variant image:", err); }
          }
          return { name: option.name, image: imageData };
        }));
        return { name: variant.name, options: processedOptions };
      }));

      const endpoint = activeTab === 'product' ? 'products' : activeTab === 'service' ? 'services' : 'livestreams';
      let payloadData = {};

      if (activeTab === 'livestream') {
        payloadData = { title: formData.title, streamUrl: formData.streamUrl, isLive: true, seller: user.id };
        if (formData.selectedItemId) { const selectedItem = allItemsForLive.find(i => i.id === formData.selectedItemId); if (selectedItem?.type === 'product') payloadData.relatedProduct = selectedItem.id; if (selectedItem?.type === 'service') payloadData.relatedService = selectedItem.id; }
      } else {
        if (!formData.category.trim()) { alert("Please enter a category!"); setIsSubmitting(false); return; }
        
        // --- FIXED: Inject Promo payload data ---
        payloadData = { 
          name: formData.name, 
          price: Number(formData.price), 
          isPromo: Boolean(formData.isPromo),
          promoPrice: formData.isPromo ? Number(formData.promoPrice) : null,
          category: formData.category, 
          description: formData.description, 
          stock: Number(formData.stock), 
          variantData: processedVariants, 
          customAttributes: attributes, 
          seller: user.id 
        };
        if (mediaIds.length > 0) { payloadData.media = mediaIds; }
      }

      const url = `${process.env.NEXT_PUBLIC_API_URL}/api/${endpoint}${editingId ? `/${editingId}` : ''}`;
      if (editingId) { await axios.put(url, { data: payloadData }, { headers: { Authorization: `Bearer ${token}` } }); alert('Updated successfully!'); } else { await axios.post(url, { data: payloadData }, { headers: { Authorization: `Bearer ${token}` } }); alert('Published successfully!'); }
      resetForm(activeTab); fetchMyItems(); 
    } catch (err) { alert(`Error submitting listing.`); } finally { setIsSubmitting(false); }
  };

  if (isLoading) return <div className="container" style={{textAlign:'center', padding:'2rem'}}>Loading...</div>;

  return (
    <div className="container" style={{ maxWidth: '1000px', padding: '2rem 1rem' }}>
      
      {/* --- DASHBOARD HEADER --- */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem' }}>
        <h1 style={{ color: 'var(--action-primary)', fontSize: '2.4rem', margin: 0, fontWeight: '800', letterSpacing: '-1px' }}>
          Seller Dashboard
        </h1>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn-primary" style={{ background: '#f59e0b', color: '#fff', padding: '0.6rem 1.5rem', minWidth: '120px', boxShadow: '0 4px 12px rgba(245, 158, 11, 0.2)' }} onClick={() => router.push('/seller/orders')}>📦 Orders</button>
          <button className="btn-secondary" style={{ background: 'var(--bg-element)', border: '1px solid var(--border-strong)' }} onClick={() => router.push('/')}>Back to Market</button>
        </div>
      </div>

      <div className="tab-group">
        <button className={`tab-btn ${activeTab === 'product' ? 'active' : ''}`} onClick={() => { setActiveTab('product'); resetForm('product'); }}>🛍️ Product</button>
        <button className={`tab-btn ${activeTab === 'service' ? 'active' : ''}`} onClick={() => { setActiveTab('service'); resetForm('service'); }}>🛠️ Service</button>
        <button className={`tab-btn live ${activeTab === 'livestream' ? 'active' : ''}`} onClick={() => { setActiveTab('livestream'); resetForm('livestream'); }}>🔴 Go Live</button>
        <button className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => { setActiveTab('settings'); resetForm('settings'); }}>⚙️ Settings</button>
      </div>

      {/* --- TAB CONTENT: PRODUCT / SERVICE --- */}
      {(activeTab === 'product' || activeTab === 'service') && (
        <div className="form-section" style={{ background: 'var(--bg-element)', padding: '2.5rem', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', border: '1px solid var(--border-color)' }}>
          <h2 className="section-title" style={{ marginTop: 0, marginBottom: '2rem', fontSize: '1.6rem', color: 'var(--text-main)' }}>
            {editingId ? 'Edit' : 'Create New'} {activeTab === 'product' ? 'Listing' : 'Service'}
          </h2>
          
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Item Name</label>
              <input type="text" className="input-field" placeholder="Enter product name..." value={formData.name || ''} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem', alignItems: 'end' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Regular Price (Rp)</label>
                <input type="number" className="input-field" placeholder="e.g. 50000" value={formData.price || ''} onChange={(e) => setFormData({...formData, price: e.target.value})} required />
              </div>

              {/* --- PROMO TOGGLE AND INPUT --- */}
              <div className="form-group" style={{ marginBottom: '15px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'bold', color: 'var(--action-primary)' }}>
                  <input type="checkbox" style={{ width: '18px', height: '18px' }} checked={formData.isPromo} onChange={(e) => setFormData({...formData, isPromo: e.target.checked})} />
                  🎉 Enable Promo Price
                </label>
              </div>

              {formData.isPromo && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ color: '#ef4444', fontWeight: 'bold' }}>Promo Price (Rp)</label>
                  <input type="number" className="input-field" style={{ borderColor: '#ef4444', background: '#fef2f2' }} placeholder="e.g. 40000" value={formData.promoPrice || ''} onChange={(e) => setFormData({...formData, promoPrice: e.target.value})} required={formData.isPromo} />
                </div>
              )}
              
              {activeTab === 'product' && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Total Stock</label>
                  <input type="number" min="0" className="input-field" placeholder="e.g. 100" value={formData.stock || ''} onChange={(e) => setFormData({...formData, stock: e.target.value})} />
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea className="input-field" placeholder="Describe your item in detail..." style={{ minHeight: '120px' }} value={formData.description || ''} onChange={(e) => setFormData({...formData, description: e.target.value})} />
            </div>

            {/* VARIANTS SECTION */}
            <div className="variant-box" style={{ background: 'var(--bg-input)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontWeight: '700', marginBottom: '1rem', color: 'var(--text-main)' }}>Variants (e.g., Color, Size)</label>
              {variants.map((v, vIdx) => (
                <div key={vIdx} style={{ background: 'var(--bg-element)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h4 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.1rem' }}>{v.name}</h4>
                    <button type="button" onClick={() => removeVariantType(vIdx)} style={{ color: 'var(--danger-color)', border: 'none', background: 'var(--danger-bg)', padding: '0.4rem 0.8rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}>Remove Variant</button>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '1rem' }}>
                    {v.options.map((o, oIdx) => (
                      <div key={oIdx} style={{ background: 'var(--bg-page)', padding: '0.5rem 0.8rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-secondary)' }}>{o.name}</span>
                        {o.previewUrl || o.image?.url ? (
                          <img src={o.previewUrl || `${process.env.NEXT_PUBLIC_API_URL}${o.image.url}`} alt="variant" style={{ width: '30px', height: '30px', borderRadius: '4px', objectFit: 'cover' }} />
                        ) : (
                          <input type="file" accept="image/*" onChange={(e) => handleVariantImageUpload(e, vIdx, oIdx)} style={{ width: '90px', fontSize: '10px' }} />
                        )}
                        <button type="button" onClick={() => removeVariantOption(vIdx, oIdx)} style={{ color: 'var(--danger-color)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.2rem' }}>×</button>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input type="text" className="input-field" placeholder={`New ${v.name} option (e.g. Red)`} value={newVariantOption} onChange={(e) => setNewVariantOption(e.target.value)} />
                    <button type="button" className="btn-secondary" style={{ whiteSpace: 'nowrap' }} onClick={() => addVariantOption(vIdx)}>+ Add Option</button>
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}>
                <input type="text" className="input-field" placeholder="New Variant Type (e.g., Size)" value={newVariantName} onChange={(e) => setNewVariantName(e.target.value)} />
                <button type="button" className="btn-secondary" style={{ whiteSpace: 'nowrap' }} onClick={addVariantType}>+ Add Variant Group</button>
              </div>
            </div>

            {/* ATTRIBUTES SECTION */}
            <div className="variant-box" style={{ background: 'var(--bg-input)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
               <label style={{ display: 'block', fontWeight: '700', marginBottom: '1rem', color: 'var(--text-main)' }}>Custom Attributes (e.g., Brand, Material)</label>
               {attributes.map((attr, idx) => (
                 <div key={idx} style={{ display: 'flex', gap: '10px', marginBottom: '0.75rem', alignItems: 'center' }}>
                   <input type="text" className="input-field" placeholder="Name (e.g. Brand)" value={attr.key} onChange={(e) => updateAttribute(idx, 'key', e.target.value)} />
                   <input type="text" className="input-field" placeholder="Value (e.g. Nike)" value={attr.value} onChange={(e) => updateAttribute(idx, 'value', e.target.value)} />
                   <button type="button" onClick={() => removeAttribute(idx)} style={{ color: 'var(--danger-color)', background: 'var(--danger-bg)', border: 'none', borderRadius: 'var(--radius-sm)', width: '40px', height: '40px', fontSize: '1.2rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                 </div>
               ))}
               <button type="button" className="btn-secondary" onClick={addAttribute} style={{ marginTop: '0.5rem' }}>+ Add Attribute Row</button>
            </div>

            <div className="form-group">
              <label>Category</label>
              <select className="input-field" value={isCustomCategory ? "custom_option" : (formData.category || '')} onChange={handleCategoryChange} required={!isCustomCategory}>
                <option value="" disabled>Select a category...</option>
                {currentCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                <option value="custom_option">-- Add Custom Category --</option>
              </select>
              {isCustomCategory && (
                <input type="text" className="input-field" style={{marginTop: '0.5rem'}} placeholder="Enter custom category..." value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} required />
              )}
            </div>

            <div className="form-group">
              <label>Upload Main Media (Select Multiple)</label>
              <div style={{ border: '2px dashed var(--border-strong)', padding: '2rem', textAlign: 'center', borderRadius: 'var(--radius-md)', background: 'var(--bg-page)', transition: 'all 0.2s' }}>
                <input type="file" multiple className="file-input" onChange={handleMainMediaChange} accept="image/*,video/*" style={{ width: '100%', cursor: 'pointer' }} />
              </div>
              {previews.length > 0 && (
                <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginTop: '1.5rem' }}>
                  {previews.map((src, idx) => (
                    <div key={idx} style={{ position: 'relative', width: '100px', height: '100px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-color)' }}>
                      <img src={src} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button type="button" onClick={() => removeImage(idx)} style={{ position: 'absolute', top: '4px', right: '4px', background: 'var(--danger-color)', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '2.5rem' }}>
              <button type="submit" className="btn-primary" disabled={isSubmitting} style={{ flex: 2, padding: '1rem', fontSize: '1.1rem' }}>
                {isSubmitting ? 'Saving...' : editingId ? '💾 Update Listing' : '🚀 Publish Listing'}
              </button>
              {editingId && (
                <button type="button" className="btn-secondary" onClick={() => resetForm(activeTab)} style={{ flex: 1 }}>Cancel Edit</button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* --- TAB CONTENT: GO LIVE --- */}
      {activeTab === 'livestream' && (
        <div className="form-section" style={{ background: 'var(--bg-element)', padding: '2.5rem', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', border: '1px solid var(--border-color)' }}>
          <h2 className="section-title" style={{ marginTop: 0, marginBottom: '2rem' }}>Host a Live Stream</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
               <label>Stream Title</label>
               <input type="text" className="input-field" placeholder="e.g. Flash Sale Weekend!" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} required />
            </div>
            <div className="form-group">
               <label>YouTube Live URL</label>
               <input type="text" className="input-field" placeholder="https://youtube.com/..." value={formData.streamUrl} onChange={(e) => setFormData({...formData, streamUrl: e.target.value})} required />
            </div>
            <div className="form-group">
              <label>Feature a Product/Service (Optional)</label>
              <select className="input-field" value={formData.selectedItemId} onChange={(e) => setFormData({...formData, selectedItemId: e.target.value})}>
                <option value="">-- None --</option>
                {allItemsForLive.map(item => (
                  <option key={item.id} value={item.id}>[{item.type.toUpperCase()}] {item.name}</option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn-primary" style={{ background: '#ef4444', marginTop: '1.5rem' }} disabled={isSubmitting}>
              {isSubmitting ? 'Starting...' : '🔴 Start Broadcasting'}
            </button>
          </form>
        </div>
      )}

      {/* --- TAB CONTENT: SETTINGS --- */}
      {activeTab === 'settings' && (
        <div className="form-section" style={{ background: 'var(--bg-element)', padding: '2.5rem', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', border: '1px solid var(--border-color)' }}>
          <h2 className="section-title" style={{ marginTop: 0, marginBottom: '2rem' }}>Store Configuration</h2>
          <form onSubmit={handleSaveSettings}>
            <div className="form-group">
               <label>Store Name / Description</label>
               <textarea className="input-field" placeholder="Tell buyers about your shop..." style={{ minHeight: '100px' }} value={settingsData.shopDescription} onChange={(e) => setSettingsData({...settingsData, shopDescription: e.target.value})} />
            </div>
            <div className="form-group">
               <label>Midtrans Server Key</label>
               <input type="password" className="input-field" placeholder="SB-Mid-server-..." value={settingsData.midtransServerKey} onChange={(e) => setSettingsData({...settingsData, midtransServerKey: e.target.value})} />
            </div>
            <div className="form-group">
               <label>Midtrans Client Key</label>
               <input type="text" className="input-field" placeholder="SB-Mid-client-..." value={settingsData.midtransClientKey} onChange={(e) => setSettingsData({...settingsData, midtransClientKey: e.target.value})} />
            </div>
            <div className="form-group" style={{ marginTop: '2rem' }}>
              <label style={{ color: 'var(--action-primary)', fontWeight: 'bold' }}>📍 Pin Your Store Location (Required for Map Visibility)</label>
              <div style={{ height: '350px', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '2px solid var(--border-color)', marginBottom: '1rem', boxShadow: 'var(--shadow-sm)' }}>
                <MapPicker location={settingsData.shopLocation} setLocation={handleLocationChange} />
              </div>
            </div>
            <button type="submit" className="btn-primary" style={{ marginTop: '1.5rem' }} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : '💾 Save Configuration'}
            </button>
          </form>
        </div>
      )}

      {/* --- YOUR ITEMS LIST (MANAGEMENT) --- */}
      {activeTab !== 'settings' && (
        <div className="form-section" style={{ marginTop: '3rem', background: 'transparent', padding: 0, boxShadow: 'none', border: 'none' }}>
          <h2 className="section-title" style={{ fontSize: '1.5rem', color: 'var(--text-main)', borderBottom: '2px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
            Manage Your {activeTab === 'product' ? 'Products' : activeTab === 'service' ? 'Services' : 'Live Streams'}
          </h2>
          {myItems.length === 0 ? (
            <div style={{ background: 'var(--bg-element)', padding: '3rem', textAlign: 'center', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-strong)' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', margin: 0 }}>You haven't listed anything in this category yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {myItems.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', background: 'var(--bg-element)', boxShadow: 'var(--shadow-sm)', transition: 'transform 0.2s' }}>
                  <div>
                    <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem', color: 'var(--text-main)' }}>{item.name || item.title}</h3>
                    
                    {/* --- Display Promo Price visually in the management list --- */}
                    {item.price && (
                      <p style={{ margin: 0, color: 'var(--action-primary)', fontWeight: '800', fontSize: '1.1rem' }}>
                        {item.isPromo ? (
                          <>
                            <span style={{ textDecoration: 'line-through', color: '#9ca3af', marginRight: '8px', fontSize: '0.9rem' }}>
                              Rp {item.price.toLocaleString('id-ID')}
                            </span>
                            <span style={{ color: '#ef4444' }}>Rp {item.promoPrice.toLocaleString('id-ID')}</span>
                            <span style={{ marginLeft: '8px', background: '#fef2f2', color: '#ef4444', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', border: '1px solid #fca5a5' }}>PROMO</span>
                          </>
                        ) : (
                          `Rp ${item.price.toLocaleString('id-ID')}`
                        )}
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button onClick={() => handleEdit(item)} className="btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.95rem' }}>Edit</button>
                    <button onClick={() => handleDelete(item._documentId || item.id)} className="btn-primary" style={{ background: 'var(--danger-bg)', color: 'var(--danger-color)', padding: '0.5rem 1rem', fontSize: '0.95rem', boxShadow: 'none' }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}