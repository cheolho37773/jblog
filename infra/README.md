# infra: 로컬 데이터베이스

로컬 개발용 PostgreSQL 17을 Docker Compose로 띄운다. 앱(web·api)은 호스트에서 실행한다 (개요 §6).
Compose 프로젝트 이름은 `jblog`, 서비스 이름은 `db`, 데이터는 이름 있는 볼륨 `pgdata`에 저장된다.

## 1. 준비물

- Docker (Compose v2 이상)
- Node 24와 pnpm (`nvm use`, `corepack pnpm install`). 아래의 `pnpm db:*` 명령에 필요하다.

## 2. `.env` 만들기

```bash
cp infra/.env.example infra/.env
```

`infra/.env`의 `POSTGRES_PASSWORD`를 `change-me`에서 본인이 정한 값으로 바꾼다. 이 파일은 커밋하지 않는다.
`backend/.env`의 `DATABASE_URL`(사용자·비밀번호·DB 이름)은 이 값과 같아야 한다.

## 3. 기동과 상태 확인

```bash
pnpm db:up     # 백그라운드로 띄우고 healthy가 될 때까지 기다린다
docker compose -f infra/docker-compose.yml --env-file infra/.env ps
```

`STATUS`가 `healthy`면 준비된 것이다. 포트는 `127.0.0.1:5432`에만 열린다(같은 네트워크의 다른 기기에서는 접속할 수 없다).

## 4. 앱 없이 접속

```bash
pnpm db:psql   # 컨테이너 안의 psql로 접속한다 (비밀번호 입력 불필요)
```

호스트에 `psql`이 있으면 직접 접속할 수도 있다. 비밀번호는 명령에 쓰지 말고 입력 프롬프트나 `PGPASSWORD` 환경변수로 넘긴다.

```bash
psql -h 127.0.0.1 -p 5432 -U <POSTGRES_USER> -d <POSTGRES_DB>
```

## 5. 중지와 초기화

```bash
pnpm db:down   # 컨테이너만 지운다. 데이터(pgdata 볼륨)는 남는다
```

경고: 아래 명령은 `pgdata` 볼륨까지 지워 **모든 데이터가 삭제된다**. 처음부터 다시 시작할 때만 쓴다.

```bash
docker compose -f infra/docker-compose.yml --env-file infra/.env down -v
```

## 6. 문제 해결

- `POSTGRES_PASSWORD 가 필요합니다` 같은 오류: `infra/.env`가 없거나 해당 변수가 비어 있다. 2단계를 다시 한다.
- 5432 포트 충돌(`port is already allocated`): 호스트에서 다른 PostgreSQL이 5432를 쓰고 있다. 그 서버를 멈추거나 다른 컨테이너를 정리한다. (포트 변경은 지원하지 않는다.)
- `unhealthy`이거나 기동이 끝나지 않을 때: 로그를 확인한다.

  ```bash
  docker compose -f infra/docker-compose.yml --env-file infra/.env logs db
  ```

- `.env`의 사용자·비밀번호·DB를 바꿨는데 반영되지 않을 때: 이 값은 볼륨을 처음 만들 때만 적용된다. 데이터를 버려도 되면 5단계의 `down -v` 후 다시 기동한다.
