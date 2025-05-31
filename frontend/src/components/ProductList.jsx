// frontend/src/components/ProductList.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext'; // <<< Importuj useCart

function ProductList() {
    // ... (products, loading, error - bez zmian)
    const { addToCart } = useCart(); // <<< Użyj hooka useCart
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        // ... (fetchProducts - bez zmian) ...
        const fetchProducts = async () => {
            setLoading(true); setError(null);
            try {
                const response = await fetch('http://localhost:3001/products');
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();
                setProducts(data);
            } catch (e) { console.error("Fetching products failed:", e); setError(e.message);
            } finally { setLoading(false); }
        };
        fetchProducts();
    }, []);

    // ... (obsługa loading, error, braku produktów - bez zmian) ...
    if (loading) return <p>Ładowanie produktów...</p>;
    if (error) return <p>Błąd: {error}</p>;
    if (products.length === 0) return <p>Brak produktów.</p>;

    return (
        <div>
            <h2>Lista Produktów</h2>
            <ul>
                {products.map(product => (
                    <li key={product.id}>
                        <h3>
                            <Link to={`/products/${product.id}`}>
                                {product.name}
                            </Link>
                        </h3>
                        <p>Cena: {product.price} PLN</p>
                        <p>Kategoria: {product.category}</p>
                        <button onClick={() => { addToCart(product); alert(`${product.name} dodany do koszyka!`); }}>
                            Dodaj do koszyka
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default ProductList;