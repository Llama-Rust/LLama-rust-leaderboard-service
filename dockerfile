# ---- deps ----
    FROM node:20-slim AS deps
    WORKDIR /app
    COPY package*.json ./
    RUN npm ci
    
    # ---- builder ----
    FROM node:20-slim AS builder
    WORKDIR /app
    # need node_modules for devDeps (tsc) and package.json for "npm run build"
    COPY --from=deps /app/node_modules ./node_modules
    COPY package*.json ./
    COPY tsconfig.json ./
    COPY src ./src
    RUN npm run build
    
    # ---- runtime ----
    FROM node:20-slim AS runtime
    WORKDIR /app
    ENV NODE_ENV=production
    # keep these as read-at-runtime; values come from env/--env-file
    ENV PORT=8080
    ENV RCON_HOST=""
    ENV RCON_PORT=""
    ENV RCON_PASSWORD=""
    ENV SUPABASE_URL=""
    ENV SUPABASE_SERVICE_KEY=""
    ENV POLL_TOKEN=""
    
    COPY package*.json ./
    RUN npm ci --omit=dev && npm cache clean --force
    COPY --from=builder /app/dist ./dist
    
    EXPOSE 8080
    USER node
    CMD ["node", "dist/server.js"]
    
    