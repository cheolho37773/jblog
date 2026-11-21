# jblog backend 이미지 (백엔드 §8, M0-08 동작 규약 7). 배포는 보류(개요 §6-a): 빌드 검증까지만 한다.
#
# 빌드(저장소 루트에서): docker build -f backend/Dockerfile -t jblog-backend .
# 실행: 환경값(NODE_ENV, API_PORT, DATABASE_URL)은 실행 시 주입한다. 이미지에는 넣지 않는다 (개요 §6-b).
#   docker run --env-file <파일> -p 4000:4000 jblog-backend
# 시작하면 prisma migrate deploy로 마이그레이션을 적용한 뒤 서버를 띄운다.

# 저장소 Node 버전(.nvmrc 24)과 맞춘 정확한 태그. 움직이는 태그는 쓰지 않는다 (개요 §2.1).
ARG NODE_IMAGE=node:24.22.3-alpine

# ---- 공통: corepack이 package.json의 packageManager 버전(pnpm)을 준비한다 ----
FROM ${NODE_IMAGE} AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo

# 설치에 필요한 매니페스트. frozen-lockfile은 잠금 파일의 모든 워크스페이스 매니페스트를 대조하므로
# frontend/package.json도 넣는다. postinstall(prisma generate)이 읽는 파일도 설치 전에 둔다.
FROM base AS manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/package.json frontend/
COPY backend/package.json backend/prisma.config.ts backend/
COPY backend/prisma backend/prisma
COPY backend/src/config/env.source.ts backend/src/config/

# ---- 빌드: 전체 의존성으로 prisma generate + nest build ----
FROM manifests AS build
RUN --mount=type=cache,id=jblog-pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @jblog/backend
COPY tsconfig.base.json ./
COPY backend/ backend/
RUN pnpm --filter @jblog/backend build

# ---- 운영 의존성만: prisma CLI(migrate deploy)와 schema-engine(@prisma/engines postinstall) 포함 ----
FROM manifests AS prod-deps
RUN --mount=type=cache,id=jblog-pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod --filter @jblog/backend

# ---- 실행 ----
FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
# pnpm의 backend/node_modules는 루트 node_modules/.pnpm을 가리키는 상대 링크라 두 폴더의 위치 관계를 유지한다.
COPY --from=prod-deps /repo/node_modules node_modules
COPY --from=prod-deps /repo/backend/node_modules backend/node_modules
COPY --from=build /repo/backend/dist backend/dist
# migrate deploy가 읽는 파일: prisma.config.ts → src/config/env.source.ts, prisma/(스키마·마이그레이션)
COPY backend/package.json backend/prisma.config.ts backend/
COPY backend/prisma backend/prisma
COPY backend/src/config/env.source.ts backend/src/config/

WORKDIR /app/backend
USER node

# API_PORT의 로컬 기본값(개요 §6). 실제 포트는 실행 시 주입한 API_PORT를 따른다.
EXPOSE 4000

# /api/health는 DB 연결까지 확인한다(503이면 비정상). 마이그레이션 시간을 고려해 start-period를 둔다.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.API_PORT}/api/health`).then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]

# exec: node가 PID 1을 이어받아 종료 신호(SIGTERM)를 직접 받는다.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && exec node dist/main.js"]
