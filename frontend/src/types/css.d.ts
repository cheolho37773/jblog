// next-env.d.ts는 빌드 때 생성되어 깨끗한 체크아웃(CI typecheck)에는 없다.
// 전역 CSS 부수효과 import가 그것 없이도 타입 검사를 통과하도록 선언한다.
declare module '*.css';
