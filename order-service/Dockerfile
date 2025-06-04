# sklep-internetowy/order-service/Dockerfile
FROM node:18-alpine AS base

WORKDIR /usr/src/app

# Instalacja curl (dla healthchecków) i nodemon globalnie
RUN apk add --no-cache curl && npm install -g nodemon

COPY package*.json ./

# Instalujemy zależności (w tym devDependencies, jeśli nodemon jest tam zdefiniowany)
RUN npm ci
# lub RUN npm install

COPY . .

ENV PORT=3002
EXPOSE ${PORT}

# Uruchamiamy aplikację przez globalny nodemon
CMD [ "nodemon", "index.js" ]