# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
RUN npm i -g pnpm@10
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY apps/api/package.json ./apps/api/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
RUN pnpm --filter @ts-sm/api build

# RA.3 — descarga de modelos para el LLM local, preparada y comentada.
# Se activa cuando el driver del LlmPort aterrice (fuera de alcance de este spec).
# RUN mkdir -p /repo/models && \
#     curl -L -o /repo/models/model.gguf "$MODEL_DOWNLOAD_URL"

FROM base AS runtime
ENV NODE_ENV=production
RUN apk add --no-cache curl
WORKDIR /repo
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /repo/packages/shared ./packages/shared
COPY --from=build /repo/apps/api/package.json ./apps/api/package.json

EXPOSE 3000
CMD ["node", "apps/api/dist/apps/api/src/main.js"]
