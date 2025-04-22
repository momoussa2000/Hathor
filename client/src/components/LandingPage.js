import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/LandingPage.css';

const LandingPage = () => {
  const navigate = useNavigate();

  const handleEnter = () => {
    console.log('Enter button clicked, navigating to /chat');
    navigate('/chat');
  };

  return (
    <div className="landing-page">
      <div className="portal-container" onClick={handleEnter}>
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
              filter: 'drop-shadow(0 0 10px var(--primary-color))'
            }}
          ></div>
        </div>
      </div>
      
      <button className="enter-portal-button" onClick={handleEnter}>
        ✧ Enter the Sacred Chamber ✧
      </button>

      <div className="content">
        <h1>The Divine Sanctum of Hathor</h1>
        <p className="subtitle">Ancient wisdom from the Golden Goddess of Healing Oils</p>
        
        <div className="portal-description">
          <h2>✧ Celestial Alchemy of the Ancients ✧</h2>
          <p>
            Step through this mystic threshold into the divine presence of Hathor—
            Mistress of Fragrant Oils and Keeper of Sacred Healing Arts whose wisdom has been 
            veiled from mortal eyes since the fall of the great temples.
          </p>
          <p>
            Receive personalized sacred formulations—divine prescriptions 
            channeled directly from the goddess herself. Each remedy carries 
            the essence of celestial mysteries, potent oils measured with divine precision, 
            and ceremonial rituals known only to the high priestesses of Her temple.
          </p>
          <p>
            Whisper your afflictions unto the Goddess, and by Her divine grace, you shall receive 
            the exact alchemical formulas to restore balance to body, mind, and spirit. Where modern 
            remedies falter, Hathor's ancient knowledge transcends time.
          </p>
          <div className="divine-signature">
            ~ By the Sacred Sistrum and Divine Horns of Hathor ~
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage; 