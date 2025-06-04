// frontend/src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { BrowserRouter } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { initKeycloak, keycloak as keycloakInstance } from './keycloak';

import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

const theme = createTheme({
  // Tutaj możesz w przyszłości dostosować motyw MUI
  // palette: {
  //   primary: {
  //     main: '#1976d2', // Przykładowy kolor główny
  //   },
  //   secondary: {
  //     main: '#dc004e', // Przykładowy kolor pomocniczy
  //   },
  // },
});

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <p>Łączenie z serwerem uwierzytelniania...</p>
    </ThemeProvider>
  </React.StrictMode>
);

initKeycloak(() => {
    console.log("Keycloak: onAuthenticated callback (from main.jsx)");
})
.then((authenticated) => {
    console.log(`Keycloak initialized in main.jsx. User is authenticated: ${authenticated}`);
    root.render(
      <React.StrictMode>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <BrowserRouter>
            <CartProvider>
              <App kc={keycloakInstance} />
            </CartProvider>
          </BrowserRouter>
        </ThemeProvider>
      </React.StrictMode>
    );
})
.catch((error) => {
    console.error("Failed to initialize Keycloak in main.jsx, rendering error:", error);
    root.render(
      <React.StrictMode>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <p>Nie udało się połączyć z serwerem uwierzytelniania. Sprawdź konsolę.</p>
        </ThemeProvider>
      </React.StrictMode>
    );
});