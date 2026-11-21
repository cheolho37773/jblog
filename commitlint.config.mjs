/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // scope에 WBS ID(M0-02, BE-03)를 쓰므로 소문자 강제를 끈다 (협업 §5.4).
    'scope-case': [0],
    // 제목은 한글로 쓰고 도구 이름(Codex, ESLint, Prisma 등)으로 시작하는 경우가 많다.
    // 영문 대소문자 규칙은 한글 제목에 의미가 없으므로 끈다.
    'subject-case': [0],
    // 본문·trailer(Co-Authored-By 등)는 길어질 수 있어 경고로만 둔다.
    'body-max-line-length': [1, 'always', 100],
    'footer-max-line-length': [1, 'always', 100],
  },
};
