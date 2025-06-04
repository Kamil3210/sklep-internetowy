// frontend/src/components/ProductList.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
// Nie importujemy już keycloak, getToken, isLoggedIn globalnie,
// będziemy używać instancji 'kc' przekazanej jako prop.

// Funkcje pomocnicze, które przyjmują instancję kc
const isAuthenticated = (kcInstance) => !!kcInstance?.authenticated;
const getToken = (kcInstance) => kcInstance?.token;

function ProductList({ kc }) { // Odbieramy kc jako prop
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { addToCart } = useCart();

    useEffect(() => {
        const fetchProducts = async () => {
            if (!kc) { // Sprawdzenie, czy instancja kc została przekazana
                console.error("[ProductList] Keycloak instance (kc prop) is missing!");
                setError("Błąd konfiguracji uwierzytelniania.");
                setLoading(false);
                return;
            }

            console.log("[ProductList] Fetching products. kc.initialized:", kc.initialized);
            setLoading(true);
            setError(null);

            try {
                const requestHeaders = {
                    'Content-Type': 'application/json',
                };

                if (isAuthenticated(kc)) {
                    try {
                        const refreshed = await kc.updateToken(30); // Używamy kc.updateToken
                        if (refreshed) {
                            console.log('[ProductList] Token was refreshed');
                        } else {
                            console.log('[ProductList] Token not refreshed, still valid.');
                        }
                        requestHeaders['Authorization'] = 'Bearer ' + getToken(kc); // Używamy getToken(kc)
                    } catch (e) {
                        console.error('[ProductList] Failed to refresh token:', e);
                        // Można obsłużyć błąd odświeżania, np. wylogowując użytkownika
                        // kc.logout();
                    }
                }

                const response = await fetch('http://localhost:3001/products', {
                    method: 'GET',
                    headers: requestHeaders,
                });

                if (!response.ok) {
                    let errorData;
                    try {
                        errorData = await response.json();
                    } catch (e) {
                        errorData = { message: response.statusText };
                    }
                    throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.message || response.statusText}`);
                }
                const data = await response.json();
                setProducts(data);
            } catch (e) {
                console.error("[ProductList] Fetching products failed:", e);
                setError(e.message);
            } finally {
                setLoading(false);
            }
        };

        // Wywołaj fetchProducts tylko jeśli kc jest dostępne i zainicjalizowane
        if (kc && kc.initialized) {
            fetchProducts();
        } else if (kc) {
            // Jeśli kc jest, ale nie initialized, poczekaj na onReady (choć App powinien to zapewnić)
            console.log("[ProductList] kc exists but not initialized, waiting for onReady or relying on App's timing.");
            // Można by dodać kc.onReady = fetchProducts; ale App powinien to obsłużyć.
            // Na razie, dla uproszczenia, zakładamy, że App renderuje nas po inicjalizacji kc.
            // Jeśli App renderuje ProductList zanim kc.initialized jest true, to jest problem w App.jsx/main.jsx
            // W naszym obecnym main.jsx, App jest renderowany po initKeycloak, więc kc.initialized powinno być true.
             fetchProducts(); // Spróbujmy mimo wszystko, logika wewnątrz powinna sobie poradzić
        } else {
            console.warn("[ProductList] Keycloak instance (kc) not available on mount.");
            // Można ustawić błąd lub poczekać, ale to wskazuje na problem z przekazywaniem propa.
            setError("Brak instancji uwierzytelniania.");
            setLoading(false);
        }

    }, [kc]); // Dodajemy kc do tablicy zależności, aby zareagować, jeśli instancja by się zmieniła (choć nie powinna)

    const handleAddToCart = (product) => {
        addToCart(product, 1);
        alert(`${product.name} został dodany do koszyka!`);
    };

    if (loading) {
        return <p>Ładowanie produktów...</p>;
    }

    if (error) {
        return <p>Błąd podczas ładowania produktów: {error}</p>;
    }

    if (products.length === 0) {
        return <p>Brak produktów do wyświetlenia.</p>;
    }

    return (
        <div>
            <h2>Lista Produktów</h2>
            <ul style={{ listStyleType: 'none', padding: 0 }}>
                {products.map(product => (
                    <li key={product.id} style={{ border: '1px solid #eee', margin: '10px', padding: '15px' }}>
                        <h3>
                            <Link to={`/products/${product.id}`}>
                                {product.name}
                            </Link>
                        </h3>
                        <p>Cena: {parseFloat(product.price).toFixed(2)} PLN</p>
                        <p>Kategoria: {product.category}</p>
                        <button onClick={() => handleAddToCart(product)}>
                            Dodaj do koszyka
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default ProductList;