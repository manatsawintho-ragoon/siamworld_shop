# syntax=docker/dockerfile:1
FROM node:20-alpine
RUN apk add --no-cache docker-cli docker-cli-compose bash jq openssl util-linux
WORKDIR /app
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --registry=https://registry.npmmirror.com
COPY . .
RUN npm run build
EXPOSE 5000
CMD ["node", "dist/server.js"]
