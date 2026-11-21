// toBeInTheDocument 같은 jest-dom matcher를 Vitest expect에 등록하고,
// 각 테스트 뒤에 렌더한 DOM을 정리한다(Vitest는 globals를 쓰지 않아 자동 정리가 없다).
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
