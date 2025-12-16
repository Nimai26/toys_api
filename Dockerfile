# Dockerfile
FROM node:20-slim

WORKDIR /app

# Installer dépendances système minimales (si besoin futur)
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

# Copier package.json et installer
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

# Copier le code
COPY . .

EXPOSE 3000

CMD ["node", "index.js"]
