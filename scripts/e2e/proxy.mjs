// E2E 전용 리버스 프록시. 운영의 Nginx 구조를 흉내 낸다(프론트엔드 §4, M2-E 규약 3).
//
// 왜 필요한가: 운영에서는 브라우저의 /api/*·/uploads/*를 Nginx가 Nest로 보내고, 나머지는 Next로 보낸다.
//   standalone 서버(운영과 같은 서버)에는 개발 전용 rewrite가 없으므로, 같은 분기를 이 프록시가 맡는다.
//   브라우저는 이 프록시 주소만 알고, 같은 출처(origin)로 API를 부른다.
// /internal/*은 서버끼리만 쓰는 경로라 브라우저 경로로 노출하지 않는다(Nginx도 막는다). 여기서도 404다.
//
// 환경변수(Playwright webServer가 넣는다): E2E_PROXY_PORT, E2E_PROXY_WEB_PORT, E2E_PROXY_API_PORT
import http from 'node:http';

// localhost는 컨테이너 등에서 IPv4·IPv6 중 어느 쪽으로 풀릴지 달라 연결이 엇갈린다. IPv4 루프백으로 고정한다.
const LOOPBACK_HOST = '127.0.0.1';
const API_PREFIXES = ['/api/', '/uploads/'];
const BLOCKED_PREFIX = '/internal/';
const HEALTH_PATH = '/__proxy/health';

export const isApiPath = (url) => API_PREFIXES.some((prefix) => url.startsWith(prefix));
export const isBlockedPath = (url) => url === '/internal' || url.startsWith(BLOCKED_PREFIX);

function respond(res, status, body = '') {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
  res.end(body);
}

function forward(req, res, port) {
  const upstream = http.request(
    { host: LOOPBACK_HOST, port, method: req.method, path: req.url, headers: req.headers },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    },
  );
  // 뒤쪽 서버가 죽어 있으면 조용히 빈 응답을 주지 않고 502로 드러낸다.
  upstream.on('error', (error) => {
    console.error(`e2e proxy: ${req.url} -> :${port} 실패: ${error.message}`);
    respond(res, 502, 'E2E 프록시: 뒤쪽 서버에 연결하지 못했다');
  });
  req.pipe(upstream);
}

export function createProxy({ webPort, apiPort }) {
  return http.createServer((req, res) => {
    const url = req.url ?? '/';
    if (url === HEALTH_PATH) return respond(res, 200, 'ok');
    if (isBlockedPath(url)) return respond(res, 404, 'Not Found');
    forward(req, res, isApiPath(url) ? apiPort : webPort);
  });
}

function readPort(name) {
  const port = Number(process.env[name]);
  if (!Number.isInteger(port) || port <= 0) throw new Error(`${name}에 포트 번호가 필요하다`);
  return port;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = readPort('E2E_PROXY_PORT');
  const proxy = createProxy({
    webPort: readPort('E2E_PROXY_WEB_PORT'),
    apiPort: readPort('E2E_PROXY_API_PORT'),
  });
  proxy.listen(port, () => console.log(`e2e proxy listening on :${port}`));
}
