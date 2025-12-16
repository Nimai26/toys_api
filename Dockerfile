# Dockerfile
FROM node:20-slim

WORKDIR /app

# Installer les dépendances système pour Puppeteer/Chromium
# https://pptr.dev/troubleshooting#running-puppeteer-in-docker
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

RUN apt-get update && apt-get install -y \
    ca-certificates \
    chromium \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Copier package.json et installer
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

# Copier le code
COPY . .

EXPOSE 3000

CMD ["node", "index.js"]
