# syntax=docker/dockerfile:1
# NOTE: panel-backend intentionally runs as root — it drives Docker on the host
# (docker.sock + nsenter + iptables) to deploy/manage customer shops on the same
# VPS. This is the accepted single-VPS control-plane design, not an oversight.
FROM node:20-alpine
RUN apk add --no-cache docker-cli docker-cli-compose bash jq openssl util-linux
WORKDIR /app
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci
COPY . .
RUN npm run build
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:5000/api/health || exit 1

CMD ["node", "dist/server.js"]
