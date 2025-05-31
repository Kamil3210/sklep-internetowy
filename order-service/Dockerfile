# sklep-internetowy/order-service/Dockerfile
# Etap 1: Wybór obrazu bazowego Node.js
FROM node:18-alpine AS base

WORKDIR /usr/src/app

# Instalacja curl, potrzebnego do healthchecków
RUN apk add --no-cache curl

COPY package*.json ./
RUN npm ci --only=production
COPY . .
ENV PORT=3002
EXPOSE ${PORT}
CMD [ "node", "index.js" ]