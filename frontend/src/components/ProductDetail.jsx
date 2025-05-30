// frontend/src/components/ProductDetail.jsx
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';

function ProductDetail() {
    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { productId } = useParams(); // Pobiera parametr :productId z URL

    useEffect(() => {
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

        if (productId) {
            fetchProduct();
        }
    }, [productId]); // Efekt uruchomi się ponownie, gdy productId się zmieni

    if (loading) {
        return <p>Ładowanie szczegółów produktu...</p>;
    }

    if (error) {
        return <p>Błąd podczas ładowania produktu: {error}. Upewnij się, że produkt o ID: {productId} istnieje.</p>;
    }

    if (!product) {
        return <p>Nie znaleziono produktu.</p>;
    }

    return (
        <div>
            <Link to="/">&larr; Wróć do listy produktów</Link>
            <h2>{product.name}</h2>
            <p><strong>Cena:</strong> {product.price} PLN</p>
            <p><strong>Kategoria:</strong> {product.category}</p>
            <p><strong>ID Produktu:</strong> {product.id}</p>
            {/* Tutaj można dodać więcej szczegółów, np. opis, zdjęcia, przycisk "Dodaj do koszyka" */}
            <button onClick={() => alert(`Dodano ${product.name} do koszyka (jeszcze nie działa!)`)}>
                Dodaj do koszyka
            </button>
        </div>
    );
}

export default ProductDetail;