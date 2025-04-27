import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/LandingPage.css';

const LandingPage = () => {
  const navigate = useNavigate();

  const handleEnter = () => {
    console.log('Enter button clicked, navigating to /chat');
    // Force navigation to absolute path
    window.location.href = '/chat';
    // As a fallback, also try React Router navigation
    navigate('/chat');
  };

  return (
    <div className="landing-page">
      {/* Water ripple effect */}
      <div className="water-ripple"></div>
      
      {/* Magical floating elements */}
      <div className="magical-elements">
        <div className="lotus"></div>
        <div className="lotus"></div>
        <div className="lotus"></div>
        <div className="eye-of-horus"></div>
        <div className="eye-of-horus"></div>
        <div className="ankh"></div>
        <div className="ankh"></div>
      </div>
      
      <div 
        className="portal-container" 
        onClick={handleEnter}
        role="button"
        tabIndex={0}
        aria-label="Enter Hathor's chat portal"
        onKeyPress={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleEnter();
          }
        }}
      >
        <div className="portal-glow"></div>
        <div className="portal-ring"></div>
        <div className="portal-inner">
          <div 
            className="hathor-silhouette" 
            style={{
              backgroundImage: 'url(/images/hathor-logo-01.png)',
              backgroundSize: 'contain',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center',
              filter: 'drop-shadow(0 0 15px var(--lily-gold))'
            }}
          ></div>
        </div>
      </div>
      
      <button 
        className="enter-portal-button" 
        onClick={handleEnter}
        type="button"
        aria-label="Start chatting with Hathor"
      >
        ✧ Enter Sacred Waters ✧
      </button>

      <div className="content">
        <h1>The Blue Lily of Hathor</h1>
        <p className="subtitle">Sacred wisdom from the Egyptian Goddess of Beauty & Renewal</p>
        
        <div className="portal-description">
          <h2>✧ Waters of Eternal Beauty ✧</h2>
          <p>
            Step into the sacred waters where the blue Egyptian water lily blooms — 
            where Hathor, goddess of beauty, awaits to share ancient secrets 
            preserved through millennia.
          </p>
          <p>
            Like the water lily that opens with the morning sun, receive personalized beauty wisdom 
            crafted especially for you. Each remedy harnesses the power of natural oils and essences 
            that Hathor has blessed throughout the ages.
          </p>
          <p>
            Share your beauty concerns with Hathor, and watch as she transforms them 
            with the rejuvenating power of the blue lotus. Her divine knowledge flows 
            like the Nile itself, bringing life and beauty to all who seek it.
          </p>
          <div className="divine-signature">
            ~ Blessed by Hathor, Goddess of the Sacred Blue Lotus ~
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage; 