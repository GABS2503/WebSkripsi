"use client";
import { useState, useEffect } from 'react';
import axios from 'axios';

// --- BULLETPROOF IMAGE HELPER ---
const getImageUrl = (mediaData) => {
  if (!mediaData) return null;

  // 1. Unwrap common Strapi layers safely
  let data = mediaData;
  if (data.data) data = data.data; // Unwrap { data: ... }
  if (Array.isArray(data)) data = data[0]; // Unwrap [ ... ] array
  if (!data) return null;

  // 2. Try to find the URL
  const attributes = data.attributes || data;
  let url = attributes.url;
  
  if (!url) return null;

  // 3. Trim whitespace and check for absolute URL
  url = url.trim();
  if (url.startsWith('http') || url.startsWith('//')) return url;

  // 4. Construct URL with Base URL
  // Remove trailing slash from base and leading slash from url to avoid doubles
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
  const [replyContent, setReplyContent] = useState({}); 
  const [activeReplyId, setActiveReplyId] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (u) setUser(JSON.parse(u));
  }, []);

  useEffect(() => {
    fetchReviews();
  }, [itemId, itemType]);

  const fetchReviews = async () => {
    try {
      if (!itemId) return;

      const filterField = itemType === 'product' ? 'product' : 'service';
      
      const query = new URLSearchParams();
      // Match Item ID
      query.append(`filters[${filterField}][documentId][$eq]`, itemId);
      
      // Populate EVERYTHING deeply
      query.append('populate[user]', '*');
      query.append('populate[media]', '*');
      query.append('populate[parent]', '*'); // Needed to filter out replies
      query.append('populate[replies][populate][user]', '*'); 
      
      // Sort Newest First
      query.append('sort', 'createdAt:desc');

      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/reviews?${query.toString()}`);
      
      // --- CLIENT-SIDE FILTERING ---
      // This guarantees replies are removed from the main list
      const allReviews = res.data.data;
      const topLevelReviews = allReviews.filter(r => {
        const rData = r.attributes || r;
        const parent = rData.parent?.data || rData.parent;
        return !parent; // Keep only if Parent is null/undefined
      });

      setReviews(topLevelReviews);
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

  const handleSubmit = async (e, parentId = null) => {
    e.preventDefault();
    if (!user) { alert("Please login to review"); return; }

    const content = parentId ? replyContent[parentId] : newComment;
    if (!content?.trim()) return;

    try {
      const token = localStorage.getItem('token');
      let mediaId = null;

      // 1. Upload Image (only for main reviews)
      if (!parentId && media) {
        const formData = new FormData();
        formData.append('files', media);
        const uploadRes = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/upload`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        // Handle array response
        mediaId = uploadRes.data[0]?.id || uploadRes.data.id;
      }

      // 2. Prepare Payload Data
      const payloadData = {
          content: content,
          user: user.id,
          [itemType === 'product' ? 'product' : 'service']: itemId,
          authorName: user.username 
      };

      // --- CRITICAL FIX FOR 400 ERROR ---
      if (parentId) {
          payloadData.parent = parentId;
          payloadData.rating = 5; // Send 5 (Dummy) because '0' fails validation!
      } else {
          payloadData.rating = rating;
      }

      // Only add media if we actually have it
      if (mediaId) {
          payloadData.media = mediaId;
      }

      // 3. Send Request
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/reviews`, { data: payloadData }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // 4. Reset UI
      if (parentId) {
        setReplyContent({ ...replyContent, [parentId]: '' });
        setActiveReplyId(null);
      } else {
        setNewComment('');
        setMedia(null);
        setPreview(null);
        setRating(5);
      }
      
      // 5. Reload with delay to allow DB update
      setTimeout(() => fetchReviews(), 500);

    } catch (err) {
      // Log the EXACT error message from Strapi to Console
      console.error("Submit Error:", err.response?.data?.error || err.message);
      const msg = err.response?.data?.error?.message || "Failed to submit review";
      alert(`Error: ${msg}`);
    }
  };

  const renderStars = (count) => {
    const safeCount = Math.max(0, Math.min(5, count || 0));
    return "★".repeat(safeCount) + "☆".repeat(5 - safeCount);
  };

  return (
    <div style={{ marginTop: '3rem', background: 'white', padding: '2rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
      <h3 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Customer Reviews</h3>

      {/* --- WRITE REVIEW FORM --- */}
      {user ? (
        <form onSubmit={(e) => handleSubmit(e)} style={{ marginBottom: '2rem', background: '#f9fafb', padding: '1.5rem', borderRadius: '8px' }}>
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
          <button type="submit" className="btn-primary" style={{ background: '#2563eb', color: 'white', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Submit Review</button>
        </form>
      ) : (
        <div style={{ padding: '1rem', background: '#eff6ff', color: '#1e40af', borderRadius: '6px', marginBottom: '2rem' }}>Please <a href="/login" style={{ fontWeight: 'bold', textDecoration: 'underline' }}>log in</a> to write a review.</div>
      )}

      {/* --- REVIEWS LIST --- */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {reviews.length === 0 && <p style={{ color: '#6b7280' }}>No reviews yet. Be the first!</p>}
        
        {reviews.map((review) => {
          const rData = review.attributes || review;
          const rUser = rData.user?.data?.attributes || rData.user || {};
          const rMediaUrl = getImageUrl(rData.media);
          
          const reviewId = review.documentId || review.id;
          const isActiveReply = activeReplyId === reviewId;

          // Process Replies: Ensure they are an array and SORT them Oldest First
          let replies = rData.replies?.data || rData.replies || [];
          if (Array.isArray(replies)) {
             replies = [...replies].sort((a, b) => {
                const dateA = new Date(a.attributes?.createdAt || a.createdAt);
                const dateB = new Date(b.attributes?.createdAt || b.createdAt);
                return dateA - dateB; // Ascending Order
             });
          }

          return (
            <div key={reviewId} style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '1.5rem' }}>
              
              {/* Review Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '35px', height: '35px', background: '#3b82f6', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                    {rUser.username?.[0]?.toUpperCase() || (rData.authorName ? rData.authorName[0].toUpperCase() : 'U')}
                  </div>
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{rUser.username || rData.authorName || 'Anonymous'}</div>
                    <div style={{ color: '#fbbf24', fontSize: '0.9rem' }}>{renderStars(rData.rating || 0)}</div>
                  </div>
                </div>
                
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{new Date(rData.createdAt).toLocaleDateString()}</div>
                    {user && (
                        <button 
                        onClick={() => setActiveReplyId(isActiveReply ? null : reviewId)}
                        style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.85rem', cursor: 'pointer', padding: 0, marginTop: '4px' }}
                        >
                        {isActiveReply ? 'Cancel' : 'Reply'}
                        </button>
                    )}
                </div>
              </div>

              {/* Content */}
              <p style={{ color: '#374151', lineHeight: '1.5', margin: '0.5rem 0' }}>{rData.content}</p>
              
              {/* Image */}
              {rMediaUrl && (
                <img 
                  src={rMediaUrl} 
                  alt="Review attachment" 
                  style={{ maxWidth: '150px', maxHeight: '150px', borderRadius: '6px', marginTop: '0.5rem', border: '1px solid #eee', display: 'block' }} 
                />
              )}

              {/* Reply Form */}
              {isActiveReply && user && (
                <div style={{ marginTop: '1rem', marginLeft: '1rem', display: 'flex', gap: '10px', background: '#f9fafb', padding: '10px', borderRadius: '6px' }}>
                  <input 
                    className="input-field"
                    placeholder={`Reply to ${rUser.username || 'this review'}...`}
                    value={replyContent[reviewId] || ''}
                    onChange={(e) => setReplyContent({ ...replyContent, [reviewId]: e.target.value })}
                    style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px', background:'white' }}
                  />
                  <button 
                    onClick={(e) => handleSubmit(e, reviewId)}
                    style={{ background: '#2563eb', color: 'white', border: 'none', padding: '0 1rem', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Post
                  </button>
                </div>
              )}

              {/* NESTED REPLIES */}
              {replies.length > 0 && (
                <div style={{ marginTop: '1.5rem', marginLeft: '1.5rem', paddingLeft: '1rem', borderLeft: '2px solid #e5e7eb' }}>
                  {replies.map((reply) => {
                    const repData = reply.attributes || reply;
                    const repUser = repData.user?.data?.attributes || repData.user || {};
                    return (
                      <div key={reply.id} style={{ marginBottom: '1rem', background: '#f9fafb', padding: '0.8rem', borderRadius: '6px' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#111827', marginBottom:'4px' }}>
                          {repUser.username || repData.authorName || 'User'} 
                          <span style={{ fontWeight: 'normal', color: '#6b7280', marginLeft: '8px', fontSize: '0.75rem' }}>
                            {new Date(repData.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p style={{ margin: '0', fontSize: '0.9rem', color: '#4b5563', lineHeight:'1.4' }}>{repData.content}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
