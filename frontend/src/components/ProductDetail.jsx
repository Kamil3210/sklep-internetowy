// frontend/src/components/ProductDetail.jsx
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
// Nie importujemy już keycloak, getToken, isLoggedIn globalnie

// Funkcje pomocnicze, jeśli potrzebne (na razie fetchProduct jest publiczny)
// const isAuthenticated = (kcInstance) => !!kcInstance?.authenticated;
// const getToken = (kcInstance) => kcInstance?.token;

function ProductDetail({ kc }) { // Odbieramy kc jako prop
    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { productId } = useParams();
    const { addToCart } = useCart();

    useEffect(() => {
        const fetchProduct = async () => {
            // Sprawdzenie kc, jeśli w przyszłości ten endpoint miałby być zabezpieczony
            // if (!kc) {
            //     console.error("[ProductDetail] Keycloak instance (kc prop) is missing!");
            //     setError("Błąd konfiguracji uwierzytelniania.");
            //     setLoading(false);
            //     return;
            // }

            console.log(`[ProductDetail] Fetching product details for ID: ${productId}. kc.initialized: ${kc?.initialized}`);
            setLoading(true);
            setError(null);
            try {
                const requestHeaders = {
                    'Content-Type': 'application/json',
                };

                // Jeśli ten endpoint byłby zabezpieczony, dodalibyśmy token:
                // if (kc && isAuthenticated(kc)) {
                //     try {
                //         await kc.updateToken(30);
                //         requestHeaders['Authorization'] = 'Bearer ' + getToken(kc);
                //     } catch (e) {
                //         console.error('[ProductDetail] Failed to refresh token:', e);
                //     }
                // }
                
                // Obecnie GET /products/:id jest publiczny, więc nie wysyłamy tokenu
                const response = await fetch(`http://localhost:3001/products/${productId}`, {
                    method: 'GET',
                    headers: requestHeaders,
                });

                if (!response.ok) {
                    let errorData;
                    try { errorData = await response.json(); } catch (e) { errorData = { message: response.statusText };}
                    throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.message || response.statusText}`);
                }
                const data = await response.json();
                setProduct(data);
            } catch (e) {
                console.error("[ProductDetail] Fetching product failed:", e);
                setError(e.message);
            } finally {
                setLoading(false);
            }
        };

        if (productId) {
            // Podobnie jak w ProductList, wywołujemy jeśli kc jest (i jest initialized)
            // lub polegamy na App.jsx
            if (kc && kc.initialized) {
                 fetchProduct();
            } else if (kc) {
                console.log("[ProductDetail] kc exists but not initialized, waiting for onReady or relying on App's timing.");
                fetchProduct(); // Spróbujmy, publiczny endpoint nie powinien mieć problemu
            } else {
                // Jeśli kc nie ma, a endpoint jest publiczny, można go wywołać,
                // ale to wskazuje na problem z przekazywaniem propa kc.
                // Dla bezpieczeństwa, jeśli kc jest wymagane, lepiej tu obsłużyć błąd.
                console.warn("[ProductDetail] Keycloak instance (kc) not available. Fetching public data.");
                fetchProduct(); // Dla publicznego endpointu to zadziała
            }
        }

    }, [productId, kc]); // Dodajemy kc i productId do zależności

    const handleAddToCart = () => {
        if (product) {
            addToCart(product, 1);
            alert(`${product.name} został dodany do koszyka!`);
        }
    };

    if (loading) {
        return <p>Ładowanie szczegółów produktu...</p>;
    }

    if (error) {
        return <p>Błąd podczas ładowania produktu: {error}</p>;
    }

    if (!product) {
        return <p>Nie znaleziono produktu.</p>;
    }

    return (
        <div>
            <Link to="/">&larr; Wróć do listy produktów</Link>
            <h2>{product.name}</h2>
            <p><strong>Cena:</strong> {parseFloat(product.price).toFixed(2)} PLN</p>
            <p><strong>Kategoria:</strong> {product.category}</p>
            <p><strong>ID Produktu:</strong> {product.id}</p>
            <button onClick={handleAddToCart}>
                Dodaj do koszyka
            </button>
        </div>
    );
}

export default ProductDetail;
