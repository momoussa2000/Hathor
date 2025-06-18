import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import './ChatInterface.css';

// Get the backend URL from environment variable or use default
const BACKEND_URL = process.env.NODE_ENV === 'production' 
  ? '' // Empty string means same domain in production
  : 'http://localhost:5003';

function ChatInterface() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Function to detect if message contains HTML
  const containsHTML = (text) => {
    return /<[^>]*>/g.test(text);
  };

  // Function to render message content
  const renderMessageContent = (message) => {
    if (message.isUser) {
      // User messages are always plain text
      return <span>{message.text}</span>;
    }

    // For Hathor messages, check if they contain HTML
    if (containsHTML(message.text)) {
      // If HTML is detected, render with dangerouslySetInnerHTML
      // First, let's make sure links open in new tabs and have proper styling
      const processedHTML = message.text
        .replace(/<a /g, '<a class="message-link" ')
        .replace(/target="_blank"/g, 'target="_blank" rel="noopener noreferrer"');
      
      return (
        <div 
          dangerouslySetInnerHTML={{ __html: processedHTML }}
        />
      );
    } else {
      // If no HTML, use ReactMarkdown for markdown content
      return (
        <ReactMarkdown 
          components={{
            a: ({node, ...props}) => (
              <a 
                target="_blank" 
                rel="noopener noreferrer" 
                className="message-link"
                {...props}
              >
                {props.children}
              </a>
            )
          }}
        >
          {message.text}
        </ReactMarkdown>
      );
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);

    // Add user message
    setMessages(prev => [...prev, { text: userMessage, isUser: true }]);

    try {
      console.log('Sending request to:', `${BACKEND_URL}/api/chat`);
      const response = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMessage }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Add Hathor's response
      setMessages(prev => [...prev, { text: data.response, isUser: false }]);
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, { 
        text: "I apologize, but I'm having trouble connecting to my divine wisdom at the moment. Please try again later.", 
        isUser: false 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Hathor's Divine Beauty Wisdom</h1>
        <p className="subtitle">Find Your Remedy with Hathor's Wisdom</p>
      </header>

      <div className="chat-container">
        <div className="messages">
          {messages.map((message, index) => (
            <div 
              key={index} 
              className={`message ${message.isUser ? 'user' : 'hathor'}`}
            >
              <div className="message-content">
                {renderMessageContent(message)}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="message hathor">
              <div className="loading">
                <div className="dot"></div>
                <div className="dot"></div>
                <div className="dot"></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSubmit} className="input-form">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Hathor for beauty wisdom..."
            disabled={isLoading}
          />
          <button type="submit" disabled={isLoading}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

export default ChatInterface; 