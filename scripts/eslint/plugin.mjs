// 저장소 로컬 ESLint 규칙 묶음. flat config는 같은 이름(jblog)의 플러그인을 서로 다른 객체로
// 두 번 등록하면 오류를 내므로, 모든 설정 블록이 이 객체 하나를 함께 쓴다.
import { deniedNamesRule } from './denied-names.mjs';
import { importBoundariesPlugin } from './import-boundaries.mjs';
import { noHexColorRule } from './no-hex-color.mjs';

export const jblogPlugin = {
  rules: {
    ...importBoundariesPlugin.rules,
    'denied-names': deniedNamesRule,
    'no-hex-color': noHexColorRule,
  },
};
