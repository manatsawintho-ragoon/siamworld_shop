# syntax=docker/dockerfile:1
# node:22 required: TrueMoney's gift endpoint (Cloudflare bot management) blocks
# Node 20's TLS fingerprint with HTTP 403. Node 22's newer OpenSSL fingerprint is
# allowed. Verify with: scripts/test-truemoney.js --connectivity (expect HTTP 400,
# not 403). EasySlip is unaffected (its Cloudflare config is more permissive).
FROM node:22-alpine AS builder

RUN apk add --no-cache ca-certificates

WORKDIR /app
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner

RUN apk add --no-cache ca-certificates

WORKDIR /app
ENV NODE_ENV=production
ENV NODE_OPTIONS=--dns-result-order=ipv4first

COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json ./

EXPOSE 4000

# This container never controls Docker/host, so run as the unprivileged `node`
# user (CIS Docker 4.1). Panel-backend stays root because it drives the host.
USER node

# Shell form so ${BACKEND_PORT} (per-tenant listen port, e.g. 4014) expands at
# runtime; falls back to 4000 for the dev compose where the internal port is fixed.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${BACKEND_PORT:-4000}/api/health" || exit 1

CMD ["node", "dist/server.js"]
