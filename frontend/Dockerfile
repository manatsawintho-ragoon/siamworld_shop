# syntax=docker/dockerfile:1
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci
COPY . .

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

ARG NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL}

ARG BACKEND_INTERNAL_URL
ENV BACKEND_INTERNAL_URL=${BACKEND_INTERNAL_URL}

RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0

# Runtime: server-side SEO/metadata fetch talks to the backend over the internal
# Docker network (no Cloudflare round-trip). Re-declared here so it survives into
# the standalone runner stage, not just the builder.
ARG BACKEND_INTERNAL_URL
ENV BACKEND_INTERNAL_URL=${BACKEND_INTERNAL_URL}

# --chown so the non-root `node` user owns .next and can create its runtime
# fetch-cache dir under /app/.next/cache.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

# NOTE: next/image needs sharp at runtime. It is a dependency in package.json,
# and Next's output tracing pulls it into .next/standalone/node_modules, so the
# COPY above already carries it. Verify it is still there after a Next upgrade:
#   docker run --rm <image> ls node_modules/sharp
# If it ever goes missing, every /_next/image request 500s.

# Create the cache dirs in the image, owned by `node`, BEFORE any volume is
# mounted over them. Docker seeds an empty named volume from the image path it
# covers, ownership included - but only if that path exists. When it does not,
# Docker creates the mount point as root, and Next (running as `node`) then fails
# with EACCES on the whole cache tree: no image cache, and no fetch-cache either,
# which silently turns every server-side `revalidate` fetch back into a live
# request. Mounting the images cache without this line makes the site slower, not
# faster - see deploy/docker-compose.customer.yml.
RUN mkdir -p .next/cache/images .next/cache/fetch-cache \
    && chown -R node:node .next/cache

EXPOSE 3000

USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ || exit 1

CMD ["node", "server.js"]
