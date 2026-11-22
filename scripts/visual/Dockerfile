# 시각 회귀 전용 실행 이미지 (M1-05 규약 1). 기준 이미지 생성과 CI 비교가 같은 이미지에서 돌게 한다.
# 배포 이미지가 아니다. 저장소 코드는 넣지 않고(run.sh가 실행 시 마운트·복사) 실행 환경만 고정한다.
#
# 고정 규칙
# - Playwright 이미지 태그 버전은 frontend/package.json의 @playwright/test와 같아야 한다(run.sh가 검사).
#   브라우저 빌드가 라이브러리 버전과 맞아야 하기 때문이다.
# - 두 이미지 모두 태그와 digest를 함께 적는다. 태그만으로는 같은 태그가 다시 빌드되어 폰트가 바뀔 수 있다.
# - 올릴 때는 두 이미지를 바꾸고 기준 이미지를 전부 다시 만든다(pnpm test:visual:update).

# Node 24(.nvmrc)를 가져오는 용도. Playwright 이미지의 기본 Node는 24가 아니라서 바이너리만 옮긴다.
FROM node:24-bookworm-slim@sha256:dc26ae92c9fb15cf6b1d63e20f0944b2efe0f115b20e00be48fb23fceb061c54 AS node

FROM mcr.microsoft.com/playwright:v1.65.1-noble@sha256:1507cbfc550a63a6b7396791ca4f00df17beb56342d2447b3f106c306f525579

# /usr/local/bin이 /usr/bin보다 앞서므로 기본 Node 대신 이쪽이 쓰인다. corepack은 node_modules에 들어 있다.
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s ../lib/node_modules/corepack/dist/corepack.js /usr/local/bin/corepack \
 && ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
 && corepack enable
