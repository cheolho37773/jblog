import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { mergeEnvSources, readEnvFile } from './env.source';

describe('env.source (.env 파일 읽기와 병합)', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'jblog-env-source-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function writeDummyEnvFile(content: string): string {
    const filePath = join(tempDir, '.env');
    writeFileSync(filePath, content);
    return filePath;
  }

  describe('readEnvFile', () => {
    it('KEY=값 줄을 객체로 읽는다', () => {
      const filePath = writeDummyEnvFile('NODE_ENV=development\nAPI_PORT=4123\n');

      expect(readEnvFile(filePath)).toEqual({ NODE_ENV: 'development', API_PORT: '4123' });
    });

    it('따옴표 값은 따옴표를 벗겨 읽는다', () => {
      const filePath = writeDummyEnvFile('DUMMY_DOUBLE="dummy value"\nDUMMY_SINGLE=\'other\'\n');

      expect(readEnvFile(filePath)).toEqual({
        DUMMY_DOUBLE: 'dummy value',
        DUMMY_SINGLE: 'other',
      });
    });

    it('주석 줄과 빈 줄은 무시한다', () => {
      const filePath = writeDummyEnvFile('# 주석\n\nAPI_PORT=4123\n# API_PORT=9999\n');

      expect(readEnvFile(filePath)).toEqual({ API_PORT: '4123' });
    });

    it('파일이 없으면 오류 없이 빈 객체를 돌려준다', () => {
      expect(readEnvFile(join(tempDir, 'missing', '.env'))).toEqual({});
    });
  });

  describe('mergeEnvSources', () => {
    it('파일에만 있는 키가 결과에 들어간다', () => {
      expect(mergeEnvSources({ API_PORT: '4123' }, {})).toMatchObject({ API_PORT: '4123' });
    });

    it('프로세스에만 있는 키도 결과에 들어간다', () => {
      expect(mergeEnvSources({}, { NODE_ENV: 'test' })).toMatchObject({ NODE_ENV: 'test' });
    });

    it('같은 키는 프로세스 값이 파일 값보다 우선한다', () => {
      const merged = mergeEnvSources({ API_PORT: '4123' }, { API_PORT: '5000' });

      expect(merged.API_PORT).toBe('5000');
    });

    it('프로세스 값이 undefined인 키는 파일 값이 남는다', () => {
      const merged = mergeEnvSources({ API_PORT: '4123' }, { API_PORT: undefined });

      expect(merged.API_PORT).toBe('4123');
    });

    it('입력 객체를 변경하지 않는다', () => {
      const fileEnv = { API_PORT: '4123' };
      const processEnv = { API_PORT: '5000' };

      mergeEnvSources(fileEnv, processEnv);

      expect(fileEnv).toEqual({ API_PORT: '4123' });
      expect(processEnv).toEqual({ API_PORT: '5000' });
    });
  });
});
