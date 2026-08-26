# ═══════════════════════════════════════════════════════════════
# Lucksino Multi-stage Dockerfile
# ═══════════════════════════════════════════════════════════════

# ─── Base ──────────────────────────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
COPY shared/package*.json ./shared/

# ─── Server Build ──────────────────────────────────────────────
FROM base AS server-build
COPY server/package*.json ./server/
RUN cd shared && npm ci && cd ../server && npm ci
COPY shared/ ./shared/
COPY server/ ./server/
RUN cd server && npm run build

FROM node:20-alpine AS server
WORKDIR /app
COPY --from=server-build /app/server/dist ./server/dist
COPY --from=server-build /app/server/package*.json ./server/
COPY --from=server-build /app/shared/dist ./shared/dist
COPY --from=server-build /app/shared/package*.json ./shared/
RUN cd server && npm ci --omit=dev
EXPOSE 2567
CMD ["node", "server/dist/index.js"]

# ─── Client Build ─────────────────────────────────────────────
FROM base AS client-build
COPY client/package*.json ./client/
RUN cd shared && npm ci && cd ../client && npm ci
COPY shared/ ./shared/
COPY client/ ./client/
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
ENV VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}
RUN cd client && npm run build

FROM nginx:alpine AS client
COPY --from=client-build /app/client/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
