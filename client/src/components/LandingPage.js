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
              filter: 'drop-shadow(0 0 15px var(--primary-gold))'
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
        ✧ Enter Sacred Portal ✧
      </button>

      <div className="content">
        <h1>Hathor's Divine Temple</h1>
        <p className="subtitle">Ancient beauty wisdom from the Egyptian Goddess of Love & Healing</p>
        
        <div className="portal-description">
          <h2>✧ Mystical Beauty Secrets ✧</h2>
          <p>
            Step through this magical portal to meet Hathor — the goddess who guards 
            the sacred beauty rituals from ancient Egypt that have remained hidden 
            for thousands of years.
          </p>
          <p>
            Receive personalized beauty remedies crafted especially for you. Each elixir comes 
            with ancient wisdom and uses natural oils and ingredients that 
            Hathor has shared with only the most divine beings throughout time.
          </p>
          <p>
            Share your beauty concerns with Hathor, and she will 
            reveal the perfect natural healing remedy. Her ancient Egyptian knowledge 
            holds the key to beauty that transcends time itself.
          </p>
          <div className="divine-signature">
            ~ Blessed by Hathor, Goddess of Beauty & Love ~
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage; 