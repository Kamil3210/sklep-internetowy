// frontend/src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { BrowserRouter } from 'react-router-dom'; // <<< Importuj BrowserRouter

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter> {/* <<< Owiń App w BrowserRouter */}
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)