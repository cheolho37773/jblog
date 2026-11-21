import path from 'node:path';

// import 경계 규칙 (개요 D25·D26, 프론트엔드 §3 계층 규칙).
// 플러그인 대신 로컬 규칙으로 둔 이유: 경로 문자열만으로 판정하므로 파일이 실제로 있지 않아도
// 가상 filePath로 시험할 수 있고(frontend/·backend/는 M0-04·05에서 생긴다), 의존성을 늘리지 않는다.

const FRONTEND_ROOT = 'frontend';
const BACKEND_ROOT = 'backend';
const FRONTEND_SRC = `${FRONTEND_ROOT}/src`;

// Next 기본 경로 별칭 `@/*` → `frontend/src/*` (M0-05에서 같은 값으로 tsconfig에 설정한다).
const SRC_ALIAS_PREFIX = '@/';

/** @type {Record<string, string>} */
const PACKAGE_NAME_TO_PROJECT = {
  '@jblog/frontend': FRONTEND_ROOT,
  '@jblog/backend': BACKEND_ROOT,
};

// 프론트엔드 계층 (개요 D26). 키는 frontend/src 바로 아래 폴더 이름이다.
const LAYERS = ['app', 'features', 'components', 'lib', 'generated'];

// 계층별로 import할 수 없는 계층 (프론트엔드 §3). features끼리는 별도 규칙(다른 기능)으로 막는다.
/** @type {Record<string, string[]>} */
const FORBIDDEN_LAYER_IMPORTS = {
  components: ['features', 'app'],
  lib: ['features', 'app'],
  features: ['app'],
};

const MESSAGES = {
  crossProject:
    'frontend와 backend는 서로의 코드를 import하지 않는다 (개요 D25). 계약은 backend/openapi.json뿐이다.',
  crossFeature:
    '기능끼리 import하지 않는다 (개요 D26). 공용이면 components/·lib/로 옮기고, 한 화면에 둘 다 필요하면 app/에서 조립한다.',
  upwardLayer:
    '하위 계층은 상위 계층을 import하지 않는다 (개요 D26). 의존은 app → features → components·lib 순으로만 흐른다.',
};

/**
 * @typedef {object} Location
 * @property {string | null} project frontend·backend 중 속한 프로젝트
 * @property {string | null} layer frontend/src 아래 계층 (frontend 밖이면 null)
 * @property {string | null} feature features 아래 기능 이름
 */

/**
 * 저장소 루트 기준 경로(`/` 구분)가 어느 프로젝트·계층·기능에 속하는지 판정한다.
 * @param {string} repoPath
 * @returns {Location}
 */
export function locate(repoPath) {
  const [root, ...rest] = repoPath.split('/');
  if (root === BACKEND_ROOT) return { project: BACKEND_ROOT, layer: null, feature: null };
  if (root !== FRONTEND_ROOT) return { project: null, layer: null, feature: null };

  const [src, layer, feature] = rest;
  if (src !== 'src' || !LAYERS.includes(layer ?? '')) {
    return { project: FRONTEND_ROOT, layer: null, feature: null };
  }
  const featureName = layer === 'features' ? (feature ?? null) : null;
  return { project: FRONTEND_ROOT, layer: layer ?? null, feature: featureName };
}

/**
 * import 문자열이 가리키는 저장소 루트 기준 경로를 구한다. 외부 패키지면 null.
 * 패키지 이름(`@jblog/backend`)은 프로젝트 루트 경로로 바꿔 같은 방식으로 판정한다.
 * @param {string} importSource
 * @param {string} importerRepoPath
 * @returns {string | null}
 */
export function resolveTargetPath(importSource, importerRepoPath) {
  if (importSource.startsWith('.')) {
    return path.posix.join(path.posix.dirname(importerRepoPath), importSource);
  }
  if (importSource.startsWith(SRC_ALIAS_PREFIX)) {
    // `..`가 섞인 별칭(`@/features/posts/../projects/x`)을 상대 경로와 같은 기준으로 판정하려고 정규화한다.
    return path.posix.normalize(`${FRONTEND_SRC}/${importSource.slice(SRC_ALIAS_PREFIX.length)}`);
  }
  const packageName = importSource.split('/').slice(0, 2).join('/');
  return PACKAGE_NAME_TO_PROJECT[packageName] ?? null;
}

/**
 * @param {Location} from
 * @param {Location} to
 */
function isCrossProject(from, to) {
  return from.project !== null && to.project !== null && from.project !== to.project;
}

/**
 * 같은 기능 안의 import는 허용하므로 기능 이름이 다를 때만 위반이다.
 * @param {Location} from
 * @param {Location} to
 */
function isCrossFeature(from, to) {
  return from.layer === 'features' && to.layer === 'features' && from.feature !== to.feature;
}

/**
 * @param {Location} from
 * @param {Location} to
 */
function isUpwardLayerImport(from, to) {
  if (from.layer === null || to.layer === null) return false;
  const forbiddenLayers = FORBIDDEN_LAYER_IMPORTS[from.layer] ?? [];
  return forbiddenLayers.includes(to.layer);
}

/**
 * @param {Location} from
 * @param {Location} to
 * @returns {keyof typeof MESSAGES | null} 위반 종류. 위반이 아니면 null
 */
export function findViolation(from, to) {
  if (isCrossProject(from, to)) return 'crossProject';
  if (isCrossFeature(from, to)) return 'crossFeature';
  if (isUpwardLayerImport(from, to)) return 'upwardLayer';
  return null;
}

/**
 * ESLint가 주는 파일 경로를 저장소 루트 기준 `/` 구분 경로로 바꾼다.
 * @param {string} filename
 * @param {string} cwd
 */
function toRepoPath(filename, cwd) {
  return path.relative(cwd, filename).split(path.sep).join('/');
}

/** @type {import('eslint').Rule.RuleModule} */
const importBoundariesRule = {
  meta: {
    type: 'problem',
    schema: [],
    messages: MESSAGES,
  },
  create(context) {
    const importerRepoPath = toRepoPath(context.filename, context.cwd);
    const from = locate(importerRepoPath);

    /** @param {import('eslint').Rule.Node} node */
    function check(node) {
      const source = 'source' in node ? node.source : null;
      if (source?.type !== 'Literal' || typeof source.value !== 'string') return;
      const targetPath = resolveTargetPath(source.value, importerRepoPath);
      if (targetPath === null) return;
      const messageId = findViolation(from, locate(targetPath));
      if (messageId) context.report({ node, messageId });
    }

    return {
      ImportDeclaration: check,
      ExportNamedDeclaration: check,
      ExportAllDeclaration: check,
      ImportExpression: check,
    };
  },
};

export const importBoundariesPlugin = {
  rules: { 'import-boundaries': importBoundariesRule },
};
