# sklep-internetowy/product-service/Dockerfile
FROM node:18-alpine AS base

WORKDIR /usr/src/app

# Instalacja curl (dla healthchecków) i nodemon globalnie
RUN apk add --no-cache curl && npm install -g nodemon

COPY package*.json ./

# Instalujemy tylko zależności produkcyjne, jeśli nodemon jest globalny i nie jest w devDependencies
# lub wszystkie, jeśli nodemon jest w devDependencies i chcemy go używać przez npm run dev.
# Dla uproszczenia i pewności, że nodemon (globalny) i zależności aplikacji są, możemy zrobić:
RUN npm ci 
# Jeśli chcesz mniejszy obraz produkcyjny i nodemon jest tylko do dev,
# to w kroku produkcyjnym można by użyć 'npm ci --only=production',
# a dla deweloperskiego obrazu (z nodemon) osobny etap lub ten sam Dockerfile z innym CMD.
# Na razie zostawiamy 'npm ci' co zainstaluje też devDependencies (jeśli są).

COPY . .

ENV PORT=3001
EXPOSE ${PORT}

# Uruchamiamy aplikację przez globalny nodemon
CMD [ "nodemon", "index.js" ]