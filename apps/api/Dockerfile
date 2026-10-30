FROM node:22-alpine
RUN corepack enable
WORKDIR /repo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared packages/shared
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @hackaton/api...
COPY apps/api apps/api
WORKDIR /repo/apps/api
ENV NODE_ENV=production
EXPOSE 3334
CMD ["sh", "-c", "pnpm db:migrate && pnpm start"]
