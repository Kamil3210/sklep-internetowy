// frontend/src/components/ProtectedRoute.jsx
import React from 'react';
import { Navigate, Link as RouterLink } from 'react-router-dom'; // Użyj RouterLink, jeśli masz Link z MUI
// Załóżmy, że kc jest przekazywane jako prop

// Funkcje pomocnicze, które przyjmują instancję kc
const isAuthenticated = (kcInstance) => !!kcInstance?.authenticated;
const hasRole = (kcInstance, roles) => roles.some((role) => kcInstance?.hasRealmRole(role));

const ProtectedRoute = ({ children, roles, kc }) => {
    if (!kc) {
        console.error("[ProtectedRoute] Keycloak instance (kc prop) is missing! Cannot protect route.");
        // W tej sytuacji coś poszło bardzo nie tak z logiką wyżej (App.jsx)
        // Można przekierować na stronę błędu lub stronę główną
        return <Navigate to="/" replace />;
    }

    console.log("[ProtectedRoute] Rendering. kc.authenticated:", isAuthenticated(kc));
    if (roles) {
        console.log("[ProtectedRoute] Required roles:", roles);
    }

    // Zakładamy, że App.jsx renderuje ten komponent tylko wtedy, gdy kc.initialized jest true.
    // Dlatego nie sprawdzamy już tutaj kc.initialized.

    if (!isAuthenticated(kc)) {
        console.log("[ProtectedRoute] User is NOT authenticated. Calling kc.login().");
        kc.login(); 
        return <p>Przekierowywanie na stronę logowania...</p>;
    }

    if (roles && roles.length > 0) {
        const userHasRequiredRole = hasRole(kc, roles);
        console.log("[ProtectedRoute] User has required role(s) (", roles.join(', '), "):", userHasRequiredRole);
        if (!userHasRequiredRole) {
            console.log("[ProtectedRoute] User does NOT have required role. Showing 'Forbidden'.");
            return (
                <div>
                    <h2>Brak Dostępu</h2>
                    <p>Nie masz uprawnień, aby zobaczyć tę stronę.</p>
                    <RouterLink to="/">Wróć na stronę główną</RouterLink> {/* Użyj RouterLink */}
                </div>
            );
        }
    }

    console.log("[ProtectedRoute] User IS authenticated and has necessary roles. Rendering children.");
    return children;
};

export default ProtectedRoute;
