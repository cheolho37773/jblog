# jblog frontend 이미지 (프론트엔드 §2 standalone, M0-08 동작 규약 7). 배포는 보류(개요 §6-a): 빌드 검증까지만 한다.
#
# 빌드(저장소 루트에서): docker build -f frontend/Dockerfile -t jblog-frontend .
#   운영 값으로 빌드할 때: --build-arg NEXT_PUBLIC_SITE_URL=<공개 주소> --build-arg API_INTERNAL_URL=<내부 API 주소>
# 실행: 동적 렌더링이 서버에서 env를 다시 읽으므로 같은 두 값을 실행 시에도 주입한다.
#   docker run -e API_INTERNAL_URL=... -e NEXT_PUBLIC_SITE_URL=... -p 3000:3000 jblog-frontend

# 저장소 Node 버전(.nvmrc 24)과 맞춘 정확한 태그. 움직이는 태그는 쓰지 않는다 (개요 §2.1).
ARG NODE_IMAGE=node:24.22.3-alpine

# ---- 빌드 ----
FROM ${NODE_IMAGE} AS build
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

# frozen-lockfile은 잠금 파일의 모든 워크스페이스 매니페스트를 대조하므로 backend/package.json도 넣는다.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN --mount=type=cache,id=jblog-pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @jblog/frontend

COPY tsconfig.base.json ./
COPY frontend/ frontend/

# next.config가 빌드 시 env를 검증한다(없으면 빌드 실패). 비밀값이 아닌 주소만 ARG로 받는다.
# 기본값은 로컬 개발 주소(개요 §6 local)다. NEXT_PUBLIC_*와 정적 생성 페이지의 metadataBase는
# 빌드 결과에 들어가므로 운영 이미지는 실제 공개 주소로 다시 빌드해야 한다 (M-Deploy).
# ARG는 이 단계의 RUN에만 환경변수로 보이고 실행 이미지에는 남지 않는다.
ARG API_INTERNAL_URL=http://localhost:4000
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
RUN pnpm --filter @jblog/frontend build
# public/이 아직 없어도 아래 COPY가 실패하지 않게 빈 폴더를 만든다.
RUN mkdir -p frontend/public

# ---- 실행 ----
FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# outputFileTracingRoot가 저장소 루트라 server.js는 standalone/frontend/ 아래에 있다.
# server.js는 정적 파일을 복사하지 않으므로 .next/static과 public을 직접 넣는다.
# Next가 실행 중 .next/cache에 쓰므로 node 사용자 소유로 둔다.
COPY --from=build --chown=node:node /repo/frontend/.next/standalone ./
COPY --from=build --chown=node:node /repo/frontend/.next/static frontend/.next/static
COPY --from=build --chown=node:node /repo/frontend/public frontend/public

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT}/`).then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]

CMD ["node", "frontend/server.js"]
