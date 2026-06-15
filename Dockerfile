# Daimyo — production container (works on a VPS, Railway, Render, Fly.io, etc.)
FROM node:20-alpine

WORKDIR /app

# Install only production deps first (better layer caching)
COPY package*.json ./
RUN npm install --omit=dev

# App source
COPY . .

ENV NODE_ENV=production
# Platforms set PORT automatically; default to 3000 locally
EXPOSE 3000

CMD ["node", "server/index.js"]
