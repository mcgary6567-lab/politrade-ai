# ---- build web ----
FROM node:22-slim AS web
WORKDIR /web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# ---- build server ----
FROM node:22-slim AS server
WORKDIR /srv
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npm run build

# ---- runtime ----
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY server/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=server /srv/dist ./dist
COPY --from=web /web/dist ./web/dist
RUN mkdir -p /data && chown -R node:node /data
USER node
ENV DB_PATH=/data/politrade.db WEB_DIST=/app/web/dist PORT=4000
EXPOSE 4000
CMD ["node","--disable-warning=ExperimentalWarning","dist/index.js"]
