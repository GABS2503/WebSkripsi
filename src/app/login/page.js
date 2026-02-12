"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

export default function LoginPage() {
  const router = useRouter();
  const [isRegistering, setIsRegistering] = useState(false);
  const [isSeller, setIsSeller] = useState(false); 
  
  // Added shopName to state
  const [formData, setFormData] = useState({ username: '', email: '', password: '', shopName: '' });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // VALIDATION: Require Shop Name if registering as seller
    if (isRegistering && isSeller && !formData.shopName.trim()) {
      setError("Please enter a Shop Name for your store.");
      return;
    }

    try {
      if (isRegistering) {
        // --- STEP 1: REGISTER USER ---
        const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/local/register`, {
          username: formData.username,
          email: formData.email,
          password: formData.password,
        });

        const token = res.data.jwt;
        const userId = res.data.user.id;
        
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(res.data.user));

        // --- STEP 2: SET SELLER STATUS & SHOP NAME ---
        if (isSeller) {
          try {
            await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/api/users/${userId}`, 
              { 
                isSeller: true,
                shopName: formData.shopName // <--- Saving the Shop Name here
              }, 
              { headers: { Authorization: `Bearer ${token}` } }
            );
            
            // Update local storage to include the new fields
            const updatedUser = { ...res.data.user, isSeller: true, shopName: formData.shopName };
            localStorage.setItem('user', JSON.stringify(updatedUser));
            
          } catch (updateError) {
            console.error("Failed to update profile:", updateError);
          }
        }

        alert("Account created! Welcome.");

      } else {
        // --- LOGIN ---
        const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/local`, {
          identifier: formData.email,
          password: formData.password,
        });

        localStorage.setItem('token', res.data.jwt);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        alert("Logged in successfully.");
      }

      router.push('/'); 
    } catch (err) {
      console.error(err);
      const errorMessage = err.response?.data?.error?.message || 'Failed. Check your email/password.';
      setError(errorMessage);
    }
  };

  return (
    <div className="container">
      <div className="form-container">
        <h2 style={{ textAlign: 'center', color: 'var(--primary-900)' }}>
          {isRegistering ? 'Create Account' : 'Login'}
        </h2>

        {error && <p style={{ color: 'red', textAlign: 'center', fontSize:'0.9rem', background:'#ffe6e6', padding:'0.5rem', borderRadius:'4px' }}>{error}</p>}

        <form onSubmit={handleSubmit}>
          {isRegistering && (
            <div className="form-group">
              <label>Username</label>
              <input name="username" type="text" className="input-field" onChange={handleChange} required />
            </div>
          )}

          <div className="form-group">
            <label>Email</label>
            <input name="email" type="email" className="input-field" onChange={handleChange} required />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input name="password" type="password" className="input-field" onChange={handleChange} required />
          </div>

          {/* Seller Checkbox */}
          {isRegistering && (
            <>
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
                <input 
                  type="checkbox" 
                  id="sellerCheck" 
                  checked={isSeller} 
                  onChange={(e) => setIsSeller(e.target.checked)}
                  style={{ width: '20px', height: '20px' }}
                />
                <label htmlFor="sellerCheck" style={{ margin: 0, cursor:'pointer' }}>
                  I want to sell products/services
                </label>
              </div>

              {/* Shop Name Input (Only shows if checkbox is ticked) */}
              {isSeller && (
                <div className="form-group" style={{ marginTop: '1rem', animation: 'fadeIn 0.3s' }}>
                  <label>Store Name <span style={{color:'red'}}>*</span></label>
                  <input 
                    name="shopName" 
                    type="text" 
                    className="input-field" 
                    placeholder="e.g. Budi's Kitchen"
                    onChange={handleChange} 
                    // Not strictly 'required' in HTML because hidden inputs can cause errors, handled in JS
                  />
                </div>
              )}
            </>
          )}

          <button type="submit" className="btn-primary" style={{ marginTop: '1.5rem' }}>
            {isRegistering ? 'Sign Up' : 'Sign In'}
          </button>
        </form>

        <button 
          className="btn-primary btn-secondary" 
          onClick={() => setIsRegistering(!isRegistering)}
        >
          {isRegistering ? 'Already have an account? Login' : 'Create new account'}
        </button>

        <hr style={{ margin: '1.5rem 0', borderColor: 'var(--gray-200)' }} />

        <button 
          onClick={() => {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            router.push('/');
          }}
          style={{ width: '100%', padding: '0.75rem', cursor: 'pointer', background: 'none', border: 'none', color: 'var(--gray-700)', textDecoration: 'underline' }}
        >
          Continue as Guest
        </button>
      </div>
    </div>
  );
}