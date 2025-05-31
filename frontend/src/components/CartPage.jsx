// frontend/src/components/CartPage.jsx
import React from 'react';
import { useCart } from '../context/CartContext';
import { Link } from 'react-router-dom';

function CartPage() {
    const { cartItems, removeFromCart, updateQuantity, getCartTotal, clearCart } = useCart();

    if (cartItems.length === 0) {
        return (
            <div>
                <h2>Twój koszyk jest pusty</h2>
                <Link to="/">Przeglądaj produkty</Link>
            </div>
        );
    }

    return (
        <div>
            <h2>Twój Koszyk</h2>
            <ul>
                {cartItems.map(item => (
                    <li key={item.id} style={{ borderBottom: '1px solid #ccc', marginBottom: '10px', paddingBottom: '10px' }}>
                        <h4>{item.name}</h4>
                        <p>Cena: {item.price} PLN</p>
                        <p>
                            Ilość: 
                            <input 
                                type="number" 
                                value={item.quantity} 
                                onChange={(e) => updateQuantity(item.id, parseInt(e.target.value))}
                                min="0" // Pozwoli na ustawienie 0, co spowoduje usunięcie
                                style={{ width: '50px', marginLeft: '10px', marginRight: '10px' }}
                            />
                        </p>
                        <p>Suma: {(parseFloat(item.price) * item.quantity).toFixed(2)} PLN</p>
                        <button onClick={() => removeFromCart(item.id)}>Usuń</button>
                    </li>
                ))}
            </ul>
            <h3>Całkowita suma: {getCartTotal().toFixed(2)} PLN</h3>
            <button onClick={() => clearCart()} style={{ marginRight: '10px' }}>Wyczyść koszyk</button>
            <button onClick={() => alert('Przechodzenie do kasy - jeszcze nie zaimplementowane!')}>
                Przejdź do kasy
            </button>
            <br />
            <Link to="/">Kontynuuj zakupy</Link>
        </div>
    );
}

export default CartPage;