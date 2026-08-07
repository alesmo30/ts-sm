# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
RUN npm i -g pnpm@10
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/tsconfig.json ./packages/shared/
COPY packages/shared/src ./packages/shared/src
COPY apps/web/package.json ./apps/web/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS dev
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web
WORKDIR /repo/apps/web
EXPOSE 5173
CMD ["pnpm", "dev"]
