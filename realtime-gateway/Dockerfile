FROM node:22-alpine
WORKDIR /app
COPY package.json tsconfig.json ./
RUN corepack enable pnpm && pnpm i --no-frozen-lockfile
COPY server.ts ./server.ts
RUN pnpm run build
EXPOSE 3030
CMD ["pnpm", "start"]


