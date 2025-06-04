# sklep-internetowy/frontend/Dockerfile
# ---- Etap Budowania (Build Stage) ----
FROM node:18-alpine AS build-stage

WORKDIR /app

COPY package*.json ./

# Instalujemy wszystkie zależności (w tym devDependencies potrzebne do budowania)
RUN npm ci

COPY . .

# Zbudowanie aplikacji produkcyjnej
RUN npm run build

# ---- Etap Serwowania (Serve Stage) ----
FROM nginx:1.25-alpine AS serve-stage

COPY nginx.conf /etc/nginx/conf.d/default.conf

RUN rm -rf /usr/share/nginx/html/*

COPY --from=build-stage /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]