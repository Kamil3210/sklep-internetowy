# ---- Etap Budowania (Build Stage) ----
# Używamy obrazu Node.js (np. wersja 18-alpine) jako środowiska budowania
FROM node:18-alpine AS build-stage

# Ustawienie katalogu roboczego w kontenerze
WORKDIR /app

# Skopiowanie package.json i package-lock.json (lub yarn.lock)
# Kopiujemy je osobno, aby wykorzystać cache warstw Dockera
COPY package*.json ./

# Instalacja wszystkich zależności (w tym deweloperskich, potrzebnych do budowania)
# Dla npm:
RUN npm ci
# Jeśli używasz yarn:
# RUN yarn install --frozen-lockfile

# Skopiowanie reszty kodu źródłowego aplikacji
COPY . .

# Zbudowanie aplikacji produkcyjnej
# Zakładamy, że skrypt 'build' w package.json tworzy folder 'dist'
RUN npm run build

# ---- Etap Serwowania (Serve Stage) ----
# Używamy lekkiego obrazu Nginx do serwowania statycznych plików
FROM nginx:1.25-alpine AS serve-stage

# Skopiowanie niestandardowej konfiguracji Nginx dla obsługi SPA (Single Page Application)
# Ten plik nginx.conf musisz stworzyć w katalogu frontend/
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Usunięcie domyślnej strony powitalnej Nginx
RUN rm -rf /usr/share/nginx/html/*

# Skopiowanie zbudowanych plików statycznych z etapu budowania ('build-stage')
# do katalogu, z którego Nginx serwuje pliki
COPY --from=build-stage /app/dist /usr/share/nginx/html

# Ujawnienie portu 80 (standardowy port HTTP, na którym Nginx nasłuchuje)
EXPOSE 80

# Komenda startowa dla Nginx
# 'daemon off;' utrzymuje Nginx na pierwszym planie, co jest wymagane przez Docker
CMD ["nginx", "-g", "daemon off;"]