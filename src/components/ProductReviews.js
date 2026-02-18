"use client";
import { useState, useEffect } from 'react';
import axios from 'axios';

// --- IMAGE HELPER (Kept this as it works well) ---
const getImageUrl = (mediaData) => {
  if (!mediaData) return null;
  let data = mediaData;
  if (data.data) data = data.data; 
  if (Array.isArray(data)) data = data[0]; 
  if (!data) return null;
  const attributes = data.attributes || data;
  let url = attributes.url;
  if (!url) return null;
  url = url.trim();
  if (url.startsWith('http') || url.startsWith('//')) return url;
  const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:1337').replace(/\/$/, '');
  const cleanUrl = url.replace(/^\//, '');
  return `${baseUrl}/${cleanUrl}`;
};

export default function ProductReviews({ itemId, itemType }) {
  const [reviews, setReviews] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [rating, setRating] = useState(5);
  const [media, setMedia] = useState(null);
  const [preview, setPreview] = useState(null);
  const [user, setUser] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (u) setUser(JSON.parse(u));
  }, []);

  useEffect(() => {
    if (itemId) fetchReviews();
  }, [itemId, itemType]);

  const fetchReviews = async () => {
    try {
      const filterField = itemType === 'product' ? 'product' : 'service';
      const query = new URLSearchParams();
      
      // 1. Simple Filter
      query.append(`filters[${filterField}][documentId][$eq]`, itemId);
      query.append('sort', 'createdAt:desc');
      
      // 2. Simple Populate (User and Media only)
      // Removed 'parent' and 'replies' to prevent errors
      query.append('populate[0]', 'user');
      query.append('populate[1]', 'media');
      
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/reviews?${query.toString()}`);
      
      // Directly set data without complex filtering
      setReviews(res.data.data);
    } catch (err) {
      console.error("Error fetching reviews:", err);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setMedia(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) { alert("Please login to review"); return; }
    if (isSubmitting) return; 

    if (!newComment?.trim()) return;

    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('token');
      let mediaId = null;

      // 1. Upload Image logic
      if (media) {
        const formData = new FormData();
        formData.append('files', media);
        const uploadRes = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/upload`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        mediaId = uploadRes.data[0]?.id || uploadRes.data.id;
      }

      // 2. Simple Payload
      const payloadData = {
          content: newComment,
          rating: rating,
          user: user.id,
          [itemType === 'product' ? 'product' : 'service']: itemId
      };

      if (mediaId) payloadData.media = mediaId;

      // 3. Post to Strapi
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/reviews`, { data: payloadData }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // 4. Reset Form
      setNewComment('');
      setMedia(null);
      setPreview(null);
      setRating(5);
      
      // 5. Refresh List
      setTimeout(() => fetchReviews(), 500);

    } catch (err) {
      console.error("Submit Error:", err);
      const errorDetails = err.response?.data?.error?.message || "Unknown Error";
      alert(`Submission Failed: ${errorDetails}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStars = (count) => {
    const safeCount = Math.max(0, Math.min(5, count || 0));
    return "★".repeat(safeCount) + "☆".repeat(5 - safeCount);
  };

  return (
    <div style={{ marginTop: '3rem', background: 'white', padding: '2rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
      <h3 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Customer Reviews</h3>

      {/* --- FORM --- */}
      {user ? (
        <form onSubmit={handleSubmit} style={{ marginBottom: '2rem', background: '#f9fafb', padding: '1.5rem', borderRadius: '8px' }}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Rating</label>
            <div style={{ display: 'flex', gap: '5px' }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} type="button" onClick={() => setRating(star)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: star <= rating ? '#fbbf24' : '#d1d5db' }}>★</button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <textarea className="input-field" rows={3} placeholder="Write your review..." value={newComment} onChange={(e) => setNewComment(e.target.value)} style={{ width: '100%', padding: '0.8rem', borderRadius: '6px', border: '1px solid #d1d5db' }} />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem', fontSize:'0.9rem' }}>Add Photo (Optional)</label>
            <input type="file" accept="image/*" onChange={handleImageChange} />
            {preview && <img src={preview} alt="Preview" style={{ height: '60px', marginTop: '10px', borderRadius: '4px' }} />}
          </div>
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="btn-primary" 
            style={{ background: isSubmitting ? '#93c5fd' : '#2563eb', color: 'white', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '6px', fontWeight: 'bold', cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Review'}
          </button>
        </form>
      ) : (
        <div style={{ padding: '1rem', background: '#eff6ff', color: '#1e40af', borderRadius: '6px', marginBottom: '2rem' }}>Please <a href="/login" style={{ fontWeight: 'bold', textDecoration: 'underline' }}>log in</a> to write a review.</div>
      )}

      {/* --- REVIEWS LIST (Linear, No Nesting) --- */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {reviews.length === 0 && <p style={{ color: '#6b7280' }}>No reviews yet. Be the first!</p>}
        
        {reviews.map((review) => {
          const rData = review.attributes || review;
          const rUser = rData.user?.data?.attributes || rData.user || {};
          const rMediaUrl = getImageUrl(rData.media);
          const reviewId = review.documentId || review.id;

          return (
            <div key={reviewId} style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '1.5rem' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '35px', height: '35px', background: '#3b82f6', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                    {rUser.username?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{rUser.username || 'Anonymous'}</div>
                    <div style={{ color: '#fbbf24', fontSize: '0.9rem' }}>{renderStars(rData.rating || 0)}</div>
                  </div>
                </div>
                
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{new Date(rData.createdAt).toLocaleDateString()}</div>
                </div>
              </div>

              <p style={{ color: '#374151', lineHeight: '1.5', margin: '0.5rem 0' }}>{rData.content}</p>
              
              {rMediaUrl && (
                <img 
                  src={rMediaUrl} 
                  alt="Review attachment" 
                  style={{ maxWidth: '150px', maxHeight: '150px', borderRadius: '6px', marginTop: '0.5rem', border: '1px solid #eee', display: 'block' }} 
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
