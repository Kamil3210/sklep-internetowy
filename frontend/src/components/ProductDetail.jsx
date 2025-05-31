// frontend/src/components/ProductDetail.jsx
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useCart } from '../context/CartContext'; // <<< Importuj useCart

function ProductDetail() {
    const [product, setProduct] = useState(null);
    // ... (loading, error, productId - bez zmian)
    const { addToCart } = useCart(); // <<< Użyj hooka useCart
    const { productId } = useParams();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);


    useEffect(() => {
        // ... (fetchProduct - bez zmian)
        const fetchProduct = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch(`http://localhost:3001/products/${productId}`);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                setProduct(data);
            } catch (e) {
                console.error("Fetching product failed:", e);
                setError(e.message);
            } finally {
                setLoading(false);
            }
        };
        if (productId) fetchProduct();
    }, [productId]);

    const handleAddToCart = () => {
        if (product) {
            addToCart(product); // Dodajemy cały obiekt produktu
            alert(`${product.name} został dodany do koszyka!`);
        }
    };

    // ... (obsługa loading, error, !product - bez zmian)
    if (loading) return <p>Ładowanie szczegółów produktu...</p>;
    if (error) return <p>Błąd: {error}</p>;
    if (!product) return <p>Nie znaleziono produktu.</p>;

    return (
        <div>
            <Link to="/">&larr; Wróć do listy produktów</Link>
            <h2>{product.name}</h2>
            <p><strong>Cena:</strong> {product.price} PLN</p>
            <p><strong>Kategoria:</strong> {product.category}</p>
            <button onClick={handleAddToCart}> {/* <<< Zaktualizowany przycisk */}
                Dodaj do koszyka
            </button>
        </div>
    );
}

export default ProductDetail;