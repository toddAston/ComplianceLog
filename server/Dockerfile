# syntax=docker/dockerfile:1
#
# Multi-stage build for the FieldLog API. BUILD CONTEXT IS THE REPOSITORY ROOT
# (see server/docker-compose.yml `build.context: ..`) so the server can bundle the
# client's Zod source of truth from /src/domain without a workspace.
#
# Base images are tag-pinned here so a fresh checkout builds immediately. For
# production you MUST pin by digest — resolve with:
#   docker buildx imagetools inspect node:22-bookworm-slim
#   docker buildx imagetools inspect gcr.io/distroless/nodejs22-debian12:nonroot
# and replace the tags with `@sha256:...`.

# ---- deps: pruned production node_modules (shipped to runtime) ----
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY server/package.json ./
# `npm ci` is preferred once server/package-lock.json is committed; `npm install`
# keeps a lockfile-less fresh checkout buildable.
RUN npm install --omit=dev --no-audit --no-fund

# ---- build: compile/bundle to dist/server.js ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY server/package.json ./
RUN npm install --no-audit --no-fund
COPY server/ ./
# Client sources live at /src so the server's `../src/domain` imports resolve.
COPY src/ /src/
RUN npm run build

# ---- runtime: distroless, non-root, no shell, no build tools ----
FROM gcr.io/distroless/nodejs22-debian12:nonroot AS runtime
WORKDIR /app
ENV NODE_ENV=production
# package.json carries "type":"module" so node treats dist/server.js as ESM.
COPY --from=build /app/package.json ./package.json
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER nonroot
EXPOSE 8080
# The distroless nodejs image's entrypoint is already `node`; pass the script.
CMD ["dist/server.js"]
