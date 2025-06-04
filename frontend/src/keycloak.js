// frontend/src/keycloak.js
import Keycloak from 'keycloak-js';

const keycloakConfig = {
    url: 'http://localhost:8180',
    realm: 'sklep-realm',
    clientId: 'sklep-frontend-client'
};

const keycloak = new Keycloak(keycloakConfig);

const initKeycloak = (onAuthenticatedCallback) => {
    return new Promise((resolve, reject) => {
        keycloak.init({ 
            onLoad: 'check-sso', 
            silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html', 
            pkceMethod: 'S256' 
        })
        .then((authenticated) => {
            if (authenticated) {
                console.log("Keycloak: User is authenticated");
                if (onAuthenticatedCallback) {
                    onAuthenticatedCallback();
                }
            } else {
                console.log("Keycloak: User is not authenticated");
            }
            resolve(authenticated);
        })
        .catch((error) => {
            console.error("Keycloak: init failed:", error);
            reject(error);
        });
    });
};

const doLogin = () => keycloak.login();
const doLogout = () => keycloak.logout({ redirectUri: window.location.origin + '/' });
const getToken = () => keycloak.token;
const getTokenParsed = () => keycloak.tokenParsed;
const isLoggedIn = () => !!keycloak.token;
const updateToken = (successCallbackMinValidity) => {
    return keycloak.updateToken(successCallbackMinValidity)
        .then((refreshed) => {
            if (refreshed) {
                console.log('Keycloak: Token was successfully refreshed');
            } else {
                console.log('Keycloak: Token is still valid');
            }
            return refreshed;
        })
        .catch(() => {
            console.error('Keycloak: Failed to refresh token, or session has expired');
            // Można rozważyć automatyczne wylogowanie lub próbę ponownego logowania
            // keycloak.login(); 
            throw new Error('Failed to refresh token');
        });
};
const getUsername = () => keycloak.tokenParsed?.preferred_username;
const hasRole = (roles) => roles.some((role) => keycloak.hasRealmRole(role));

export {
    initKeycloak,
    doLogin,
    doLogout,
    getToken,
    getTokenParsed,
    isLoggedIn,
    updateToken,
    getUsername,
    hasRole,
    keycloak // Eksportujemy instancję dla bezpośredniego dostępu w razie potrzeby
};