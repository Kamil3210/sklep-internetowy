// frontend/src/components/AdminPage.jsx
import React, { useState } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Alert from '@mui/material/Alert';

// Importujemy bezpośrednio z naszego serwisu keycloak.js
// Zakładamy, że instancja 'keycloak' w tym pliku jest tą samą,
// którą zainicjalizował main.jsx
import { keycloak, getToken, isLoggedIn } from '../keycloak'; 

const AdminPage = () => {
    const [productName, setProductName] = useState('');
    const [productPrice, setProductPrice] = useState('');
    const [productCategory, setProductCategory] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (event) => {
        event.preventDefault();
        setMessage('');
        setError('');

        if (!isLoggedIn()) { // Sprawdzenie przez funkcję z keycloak.js
            setError('Nie jesteś zalogowany. Zaloguj się jako administrator.');
            // keycloak.login(); // Można by tu wymusić logowanie, ale ProtectedRoute powinien to załatwić
            return;
        }

        const productData = {
            name: productName,
            price: parseFloat(productPrice),
            category: productCategory,
        };

        if (!productData.name || !productData.price || !productData.category) {
            setError('Wszystkie pola są wymagane.');
            return;
        }
        if (isNaN(productData.price) || productData.price <= 0) {
            setError('Cena musi być liczbą większą od zera.');
            return;
        }

        console.log("[AdminPage] Próba dodania produktu:", productData);

        try {
            // Upewnij się, że token jest świeży
            const refreshed = await keycloak.updateToken(30); // 30 sekund minimalnej ważności
            if (refreshed) {
                console.log('[AdminPage] Token został odświeżony.');
            } else {
                console.log('[AdminPage] Token jest nadal ważny, nie wymagał odświeżenia.');
            }
            
            const token = getToken(); // Pobierz aktualny token

            if (!token) {
                setError('Nie udało się uzyskać tokenu uwierzytelniającego. Spróbuj zalogować się ponownie.');
                return;
            }
            
            console.log("[AdminPage] Wysyłanie żądania POST z tokenem:", token);

            const response = await fetch('http://localhost:3001/products', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(productData),
            });

            const responseData = await response.json(); // Spróbuj sparsować odpowiedź jako JSON

            if (response.status === 201) {
                setMessage(`Produkt "${responseData.name}" został pomyślnie dodany! ID: ${responseData.id}`);
                setProductName('');
                setProductPrice('');
                setProductCategory('');
            } else {
                setError(`Błąd podczas dodawania produktu: ${response.status} - ${responseData.message || 'Nieznany błąd serwera'}`);
                console.error("Error data from backend:", responseData);
            }
        } catch (err) {
            console.error('Błąd sieci lub inny problem podczas dodawania produktu:', err);
            setError(`Błąd sieci lub inny problem: ${err.message}`);
        }
    };

    return (
        <Paper elevation={3} sx={{ p: 3, maxWidth: 500, margin: 'auto', mt: 4 }}>
            <Typography variant="h5" component="h2" gutterBottom align="center">
                Panel Administratora - Dodaj Produkt
            </Typography>
            <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1 }}>
                <TextField
                    margin="normal"
                    required
                    fullWidth
                    id="productName"
                    label="Nazwa Produktu"
                    name="productName"
                    autoComplete="off"
                    autoFocus
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                />
                <TextField
                    margin="normal"
                    required
                    fullWidth
                    name="productPrice"
                    label="Cena Produktu (np. 19.99)"
                    type="number"
                    id="productPrice"
                    autoComplete="off"
                    value={productPrice}
                    onChange={(e) => setProductPrice(e.target.value)}
                    inputProps={{ step: "0.01" }}
                />
                <TextField
                    margin="normal"
                    required
                    fullWidth
                    name="productCategory"
                    label="Kategoria Produktu"
                    id="productCategory"
                    autoComplete="off"
                    value={productCategory}
                    onChange={(e) => setProductCategory(e.target.value)}
                />
                {message && <Alert severity="success" sx={{ mt: 2 }}>{message}</Alert>}
                {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
                <Button
                    type="submit"
                    fullWidth
                    variant="contained"
                    sx={{ mt: 3, mb: 2 }}
                >
                    Dodaj Produkt
                </Button>
            </Box>
        </Paper>
    );
};

export default AdminPage;