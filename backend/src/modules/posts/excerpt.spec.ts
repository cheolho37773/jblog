import { AUTO_EXCERPT_LENGTH, buildAutoExcerpt } from './excerpt';

describe('자동 요약 buildAutoExcerpt', () => {
  describe('강조 문법은 기호 없이 글자만 남긴다', () => {
    it.each([
      ['_강조_', '앞 _강조_ 뒤'],
      ['__굵게__', '앞 __굵게__ 뒤'],
      ['*강조*', '앞 *강조* 뒤'],
      ['**굵게**', '앞 **굵게** 뒤'],
      ['~~취소~~', '앞 ~~취소~~ 뒤'],
    ])('%s', (_name, input) => {
      const word = input.replace(/[_*~]/g, '').split(' ')[1];
      expect(buildAutoExcerpt(input)).toBe(`앞 ${word} 뒤`);
    });
  });

  describe('코드 블록은 통째로 제외한다', () => {
    it('물결표 펜스(~~~) 블록 전체를 제외한다', () => {
      const md = '앞 문장\n\n~~~ts\nconst code = 1;\n~~~\n\n뒤 문장';
      expect(buildAutoExcerpt(md)).toBe('앞 문장 뒤 문장');
    });

    it('백틱 펜스(```) 블록 전체를 제외한다', () => {
      const md = '앞 문장\n\n```ts\nconst code = 1;\n```\n\n뒤 문장';
      expect(buildAutoExcerpt(md)).toBe('앞 문장 뒤 문장');
    });
  });

  it('단어 안 일반 밑줄은 보존한다', () => {
    expect(buildAutoExcerpt('snake_case 와 my_var_name 사용')).toBe(
      'snake_case 와 my_var_name 사용',
    );
  });

  it('헤딩 문구는 유지하고 # 기호만 걷는다', () => {
    expect(buildAutoExcerpt('## 제목\n본문')).toBe('제목 본문');
  });

  it('링크는 문구만 남긴다', () => {
    expect(buildAutoExcerpt('[문구](https://example.com) 끝')).toBe('문구 끝');
  });

  it('160자로 자른다', () => {
    const result = buildAutoExcerpt('가'.repeat(300));
    expect(result).toHaveLength(AUTO_EXCERPT_LENGTH);
  });
});
