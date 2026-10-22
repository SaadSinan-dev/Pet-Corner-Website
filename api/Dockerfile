FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src
COPY scripts ./scripts
COPY test ./test
RUN npm run db:generate && npm run build && chown -R node:node /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001
USER node
EXPOSE 3001
CMD ["npm", "run", "start:production"]
