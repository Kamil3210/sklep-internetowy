// frontend/src/App.jsx
import React, { useEffect, useState } from 'react';
import { Routes, Route, Link as RouterLink } from 'react-router-dom';

// Importy MUI
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import Container from '@mui/material/Container';
import Badge from '@mui/material/Badge';
import ProductList from './components/ProductList';
import ProductDetail from './components/ProductDetail';
import CartPage from './components/CartPage';
import AdminPage from './components/AdminPage';
import ProtectedRoute from './components/ProtectedRoute';
import { useCart } from './context/CartContext';
import { doLogin as keycloakDoLogin, doLogout as keycloakDoLogout } from './keycloak'; 
import './App.css';

// Funkcje pomocnicze używające instancji kc
const getUsernameFromKc = (kcInstance) => kcInstance?.tokenParsed?.preferred_username;
const hasRoleFromKc = (kcInstance, roles) => roles.some((role) => kcInstance?.hasRealmRole(role));
const isAuthenticatedFromKc = (kcInstance) => !!kcInstance?.authenticated;
const getTokenFromKc = (kcInstance) => kcInstance?.token;


function App({ kc }) { // Odbieramy instancję keycloak jako prop 'kc'
    const { itemCount } = useCart();
    
    const [keycloakReady, setKeycloakReady] = useState(false); // <<< NOWY STAN
    const [authenticated, setAuthenticated] = useState(false);
    const [username, setUsernameState] = useState(null);
    const [isAdmin, setIsAdminState] = useState(false);

    useEffect(() => {
        if (!kc || !kc.initialized) { // Jeśli kc nie ma lub nie jest zainicjalizowane, nic nie rób
            console.log("App.jsx useEffect: kc not available or not initialized yet.");
            return;
        }

        console.log("--- App.jsx useEffect (kc is initialized) ---");
        console.log("kc.authenticated:", kc.authenticated);
        console.log("kc.token:", kc.token);

        const updateAuthState = () => {
            const authStatus = isAuthenticatedFromKc(kc);
            const currentToken = getTokenFromKc(kc);
            const currentUsername = getUsernameFromKc(kc);
            const currentUserIsAdmin = hasRoleFromKc(kc, ['admin']);

            setAuthenticated(authStatus);
            setUsernameState(currentUsername);
            setIsAdminState(currentUserIsAdmin);
            setKeycloakReady(true); // <<< USTAWIAMY, ŻE KEYCLOAK JEST GOTOWY DO UŻYCIA PRZEZ KOMPONENTY
            
            console.log("--- App.jsx updateAuthState ---");
            console.log("User is authenticated (in updateAuthState):", authStatus);
            console.log("Username (in updateAuthState):", currentUsername);
            console.log("Raw Keycloak Token (in updateAuthState):", currentToken);
            console.log("User is Admin (in updateAuthState):", currentUserIsAdmin);
            console.log("Keycloak is now marked as READY in App state.");
            console.log("-----------------------------");
        };

        updateAuthState();

        kc.onAuthSuccess = () => { console.log('Keycloak Event: onAuthSuccess'); updateAuthState(); };
        kc.onAuthError = () => { console.error('Keycloak Event: onAuthError'); updateAuthState(); };
        kc.onAuthRefreshSuccess = () => { console.log('Keycloak Event: onAuthRefreshSuccess'); updateAuthState(); };
        kc.onAuthRefreshError = () => { console.error('Keycloak Event: onAuthRefreshError'); updateAuthState(); };
        kc.onAuthLogout = () => { 
            console.log('Keycloak Event: onAuthLogout'); 
            setKeycloakReady(false); // Przy wylogowaniu możemy zresetować gotowość na chwilę
            updateAuthState();
            // Po updateAuthState, jeśli użytkownik nie jest authenticated, keycloakReady może zostać false
            // lub można je znowu ustawić na true, bo instancja kc nadal istnieje.
            // Bezpieczniej jest pozwolić updateAuthState zadecydować.
            // Po wylogowaniu authStatus będzie false, więc keycloakReady pozostanie true, ale authenticated false.
            // To jest OK.
        };
        
        return () => {
            console.log("App.jsx useEffect: Cleaning up Keycloak event listeners");
            if(kc) { // Sprawdzenie czy kc istnieje przed próbą usunięcia listenerów
                kc.onAuthSuccess = null;
                kc.onAuthError = null;
                kc.onAuthRefreshSuccess = null;
                kc.onAuthRefreshError = null;
                kc.onAuthLogout = null;
            }
        };
    }, [kc]);

    const handleLogin = () => {
        if (kc) kc.login();
    };
    const handleLogout = () => {
        if (kc) kc.logout({ redirectUri: window.location.origin + '/' });
    };

    // Renderuj główne trasy tylko jeśli Keycloak jest gotowy
    if (!keycloakReady && kc && kc.initialized === false) { // Dodatkowe sprawdzenie, czy kc istnieje, ale nie jest jeszcze gotowe
        console.log("App.jsx: Keycloak is initializing, showing loading message...");
        return <p>Inicjalizacja uwierzytelniania (z App.jsx)...</p>;
    }
    // Jeśli kc nie zostało przekazane, to jest błąd konfiguracji
    if (!kc) {
        console.error("App.jsx: Keycloak instance (kc prop) is missing!");
        return <p>Błąd krytyczny: Brak instancji uwierzytelniania.</p>;
    }


    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <AppBar position="static">
                <Toolbar>
                    <Typography variant="h6" component={RouterLink} to="/" sx={{ flexGrow: 1, color: 'inherit', textDecoration: 'none' }}>
                        Mój Sklep Internetowy
                    </Typography>
                    
                    {authenticated && isAdmin && (
                        <Button color="inherit" component={RouterLink} to="/admin" startIcon={<AdminPanelSettingsIcon />}>
                            Admin
                        </Button>
                    )}
                    <IconButton component={RouterLink} to="/cart" color="inherit" aria-label="koszyk">
                        <Badge badgeContent={itemCount} color="error">
                            <ShoppingCartIcon />
                        </Badge>
                    </IconButton>
                    {authenticated ? (
                        <>
                            <Typography sx={{ mx: 2 }}>
                                Witaj, {username || 'użytkowniku'}! {isAdmin && "(Admin)"}
                            </Typography>
                            <Button color="inherit" onClick={handleLogout}>Wyloguj</Button>
                        </>
                    ) : (
                        <Button color="inherit" onClick={handleLogin}>Zaloguj</Button>
                    )}
                </Toolbar>
            </AppBar>

            <Container component="main" sx={{ flexGrow: 1, py: 3 }}>
                {/* Renderuj Routes tylko gdy keycloakReady jest true */}
                {keycloakReady ? (
                    <Routes>
                        <Route path="/" element={<ProductList kc={kc} />} />
                        <Route path="/products/:productId" element={<ProductDetail kc={kc} />} />
                        <Route 
                            path="/cart" 
                            element={
                                <ProtectedRoute kc={kc}> {/* Przekazujemy kc do ProtectedRoute */}
                                    <CartPage />
                                </ProtectedRoute>
                            } 
                        />
                        <Route 
                            path="/admin" 
                            element={
                                <ProtectedRoute kc={kc} roles={['admin']}> {/* Przekazujemy kc i role */}
                                    <AdminPage />
                                </ProtectedRoute>
                            } 
                        />
                        <Route path="*" element={<Typography variant="h5" align="center" sx={{mt: 5}}>Strona nie znaleziona (404)</Typography>} />
                    </Routes>
                ) : (
                    <p>Finalizowanie inicjalizacji uwierzytelniania...</p> // Komunikat, gdy keycloakReady jest false
                )}
            </Container>

            <Box component="footer" sx={{ bgcolor: 'background.paper', p: 2, mt: 'auto' }}>
                {/* ... (stopka bez zmian) ... */}
            </Box>
        </Box>
    );
}

export default App;