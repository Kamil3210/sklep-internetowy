// frontend/src/App.jsx
import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import ProductList from './components/ProductList';
import ProductDetail from './components/ProductDetail';
import CartPage from './components/CartPage'; // <<< Importuj CartPage
import { useCart } from './context/CartContext'; // <<< Importuj useCart, aby wyświetlić liczbę przedmiotów
import './App.css';

function App() {
    const { itemCount } = useCart(); // <<< Pobierz itemCount

    return (
        <div className="App">
            <header className="App-header">
                <h1>
                    <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
                        Mój Sklep Internetowy
                    </Link>
                </h1>
                <nav>
                    <Link to="/cart" style={{ marginLeft: '20px' }}>
                        Koszyk ({itemCount}) {/* <<< Wyświetl liczbę przedmiotów */}
                    </Link>
                </nav>
            </header>
            <main>
                <Routes>
                    <Route path="/" element={<ProductList />} />
                    <Route path="/products/:productId" element={<ProductDetail />} />
                    <Route path="/cart" element={<CartPage />} /> {/* <<< Dodaj trasę do koszyka */}
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