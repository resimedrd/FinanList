import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Automatically clear local data if '?clear=true' is in the URL
if (window.location.search.includes('clear=true') || window.location.search.includes('reset=true')) {
  localStorage.clear();
  // Clean the URL query params without reloading the page
  const cleanUrl = window.location.origin + window.location.pathname;
  window.history.replaceState({}, document.title, cleanUrl);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

