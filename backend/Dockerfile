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
    npm ci --registry=https://registry.npmmirror.com
COPY . .
RUN npm run build

FROM node:22-alpine AS runner

RUN apk add --no-cache ca-certificates

WORKDIR /app
ENV NODE_ENV=production
ENV NODE_OPTIONS=--dns-result-order=ipv4first

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

EXPOSE 4000

CMD ["node", "dist/server.js"]
