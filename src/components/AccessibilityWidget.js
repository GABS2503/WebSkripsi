"use client";
import { useState, useEffect } from 'react';

export default function AccessibilityWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [settings, setSettings] = useState({
    largeText: false,
    highContrast: false,
    dyslexicFont: false,
    highlightLinks: false,
    readPage: false
  });

  // Load saved preferences on page load
  useEffect(() => {
    const saved = localStorage.getItem('a11y-settings');
    if (saved) {
      setSettings(JSON.parse(saved));
    }
  }, []);

  // Apply CSS classes to the body whenever settings change
  useEffect(() => {
    localStorage.setItem('a11y-settings', JSON.stringify(settings));
    
    const body = document.body;
    settings.largeText ? body.classList.add('a11y-large-text') : body.classList.remove('a11y-large-text');
    settings.highContrast ? body.classList.add('a11y-high-contrast') : body.classList.remove('a11y-high-contrast');
    settings.dyslexicFont ? body.classList.add('a11y-dyslexic') : body.classList.remove('a11y-dyslexic');
    settings.highlightLinks ? body.classList.add('a11y-highlight-links') : body.classList.remove('a11y-highlight-links');
  }, [settings]);

  // --- CLICK-TO-READ (TEXT TO SPEECH) LOGIC ---
  useEffect(() => {
    if (!settings.readPage) {
      window.speechSynthesis?.cancel();
      return;
    }

    // Highlight element being hovered over
    const handleMouseOver = (e) => {
      if (!e.target.closest('#a11y-widget')) { // Don't highlight the widget itself
        e.target.classList.add('a11y-reading-target');
      }
    };

    // Remove highlight when mouse leaves
    const handleClick = (e) => {
      // If clicking inside the widget menu, let it happen normally
      if (e.target.closest('#a11y-widget')) return; 

      // Otherwise, prevent clicking links/buttons so the user can just listen
      e.preventDefault();
      e.stopPropagation();

      window.speechSynthesis.cancel(); // Stop current speech
      const textToRead = e.target.innerText || e.target.alt || e.target.ariaLabel || e.target.textContent;
      
      if (textToRead) {
        const utterance = new SpeechSynthesisUtterance(textToRead);
        
        // --- NEW LINE: Set language to Indonesian ---
        utterance.lang = 'id-ID'; 
        
        window.speechSynthesis.speak(utterance);
      }
    };

    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mouseout', handleMouseOut);
    document.addEventListener('click', handleClick, true); // True = Capture phase

    return () => {
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseout', handleMouseOut);
      document.removeEventListener('click', handleClick, true);
      document.querySelectorAll('.a11y-reading-target').forEach(el => el.classList.remove('a11y-reading-target'));
      window.speechSynthesis?.cancel();
    };
  }, [settings.readPage]);

  const toggleSetting = (key) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const resetSettings = () => {
    setSettings({ largeText: false, highContrast: false, dyslexicFont: false, highlightLinks: false, readPage: false });
  };

  return (
    <div id="a11y-widget" style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 10000, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
      
      {/* --- EXPANDED MENU --- */}
      {isOpen && (
        <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', padding: '1.5rem', marginBottom: '15px', width: '280px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>Accessibility</h3>
            <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#64748b' }}>✖</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button onClick={() => toggleSetting('readPage')} style={getBtnStyle(settings.readPage, '#2563eb')}>
               🔊 {settings.readPage ? 'Turn Off Reading Mode' : 'Click to Read'}
            </button>
            {settings.readPage && <p style={{fontSize:'0.8rem', color:'#666', margin:'0 0 10px 0', lineHeight:'1.2'}}>When active, clicking elements reads them instead of opening links.</p>}

            <button onClick={() => toggleSetting('largeText')} style={getBtnStyle(settings.largeText)}>
               A+ Large Text
            </button>
            <button onClick={() => toggleSetting('highContrast')} style={getBtnStyle(settings.highContrast)}>
               ◑ High Contrast
            </button>
            <button onClick={() => toggleSetting('dyslexicFont')} style={getBtnStyle(settings.dyslexicFont)}>
               Ab Dyslexia Friendly
            </button>
            <button onClick={() => toggleSetting('highlightLinks')} style={getBtnStyle(settings.highlightLinks)}>
               🔗 Highlight Links
            </button>
            
            <button onClick={resetSettings} style={{ marginTop: '10px', background: '#fee2e2', color: '#b91c1c', border: 'none', padding: '10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
               Reset Settings
            </button>
          </div>
        </div>
      )}

      {/* --- FLOATING TRIGGER BUTTON --- */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#2563eb', color: 'white', border: 'none', cursor: 'pointer', boxShadow: '0 4px 10px rgba(37,99,235,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        aria-label="Open Accessibility Menu"
      >
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
           <circle cx="12" cy="12" r="10"></circle>
           <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
           <line x1="9" y1="9" x2="9.01" y2="9"></line>
           <line x1="15" y1="9" x2="15.01" y2="9"></line>
        </svg>
      </button>
    </div>
  );
}

// Helper to color active/inactive buttons
const getBtnStyle = (isActive, activeColor = '#0f172a') => ({
    padding: '10px 15px',
    borderRadius: '8px',
    border: `2px solid ${isActive ? activeColor : '#cbd5e1'}`,
    background: isActive ? '#eff6ff' : 'white',
    color: isActive ? activeColor : '#475569',
    fontWeight: 'bold',
    cursor: 'pointer',
    textAlign: 'left',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.2s'
});
