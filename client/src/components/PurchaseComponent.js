import React, { useState, useEffect } from 'react';
import axios from 'axios';

const PurchaseComponent = ({ userId }) => {
  const [cart, setCart] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Check subscription status on component mount
    checkSubscriptionStatus();
  }, [userId]);

  const checkSubscriptionStatus = async () => {
    try {
      const response = await axios.get(`http://localhost:5003/api/subscriptions/${userId}`);
      setSubscription(response.data);
    } catch (error) {
      console.error('Error checking subscription status:', error);
    }
  };

  const handlePurchase = async () => {
    try {
      const response = await axios.post('http://localhost:5003/api/purchases', {
        userId,
        items: cart
      });

      setMessage(response.data.message);
      if (response.data.subscription) {
        setSubscription(response.data.subscription);
      }
      setCart([]); // Clear cart after purchase
    } catch (error) {
      console.error('Error processing purchase:', error);
      setMessage('Error processing purchase. Please try again.');
    }
  };

  const addToCart = (oilId) => {
    setCart([...cart, { oilId, quantity: 1 }]);
  };

  return (
    <div className="purchase-container">
      <h2>Your Cart</h2>
      <div className="cart-items">
        {cart.map((item, index) => (
          <div key={index} className="cart-item">
            <span>Oil ID: {item.oilId}</span>
            <span>Quantity: {item.quantity}</span>
          </div>
        ))}
      </div>
      
      <div className="subscription-status">
        {subscription && subscription.isActive ? (
          <p>
            You have an active subscription until {new Date(subscription.endDate).toLocaleDateString()}
            {subscription.isFree && ' (Free with purchase)'}
          </p>
        ) : (
          <p>No active subscription</p>
        )}
      </div>

      <button 
        onClick={handlePurchase}
        disabled={cart.length === 0}
        className="purchase-button"
      >
        Complete Purchase
      </button>

      {message && <p className="message">{message}</p>}
    </div>
  );
};

export default PurchaseComponent; 