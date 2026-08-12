# syntax=docker/dockerfile:1

FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json .npmrc ./
COPY frontend/package.json ./frontend/package.json
COPY backend/package.json ./backend/package.json
RUN npm ci

COPY frontend ./frontend
COPY backend ./backend
RUN VITE_API_BASE_URL=/ npm run build --workspace frontend
RUN npm run build --workspace backend

FROM node:24-alpine AS runtime
WORKDIR /app

COPY package.json package-lock.json .npmrc ./
COPY frontend/package.json ./frontend/package.json
COPY backend/package.json ./backend/package.json
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/backend ./backend
COPY --from=build /app/frontend/dist ./frontend/dist

ENV HOST=0.0.0.0
ENV FRONTEND_DIST=/app/frontend/dist
ENV NODE_ENV=production

USER node

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 CMD wget -qO- "http://127.0.0.1:${PORT:-4010}/health" || exit 1

CMD ["node", "backend/src/server.ts"]
