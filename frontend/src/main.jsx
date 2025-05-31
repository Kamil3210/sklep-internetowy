// frontend/src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { BrowserRouter } from 'react-router-dom';
import { CartProvider } from './context/CartContext'; // <<< Importuj CartProvider

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <CartProvider> {/* <<< Owiń App w CartProvider */}
        <App />
      </CartProvider>
    </BrowserRouter>
  </React.StrictMode>,
)