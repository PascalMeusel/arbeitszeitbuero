FROM node:24-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PORT=4177
ENV TIME_TRACKER_DATA=/data/time-tracker.sqlite
ENV TIME_TRACKER_BACKUP_DIR=/data/backups

WORKDIR /app

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/shared ./shared
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/licenses ./licenses
COPY --from=build /app/docs ./docs
COPY --from=build /app/LICENSE.md /app/README.md /app/THIRD_PARTY_NOTICES.md ./

RUN mkdir -p /data/backups

VOLUME ["/data"]
EXPOSE 4177

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 4177) + '/api/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "--import", "tsx", "server/index.ts"]
