// frontend/src/App.jsx
import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import ProductList from './components/ProductList';
import ProductDetail from './components/ProductDetail'; // <<< Odkomentuj import
import './App.css';

function App() {
    return (
        <div className="App">
            <header className="App-header">
                <h1>
                    <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
                        Mój Sklep Internetowy
                    </Link>
                </h1>
            </header>
            <main>
                <Routes>
                    <Route path="/" element={<ProductList />} />
                    <Route path="/products/:productId" element={<ProductDetail />} /> {/* <<< Odkomentuj tę trasę */}
                    <Route path="*" element={<p>Nie znaleziono strony (404)</p>} />
                </Routes>
            </main>
            <footer>
                <p>© {new Date().getFullYear()} Mój Sklep</p>
            </footer>
        </div>
    );
}

export default App;