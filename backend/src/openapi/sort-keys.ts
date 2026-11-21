// 같은 문서는 항상 같은 바이트가 되도록 객체 키를 재귀적으로 정렬한다.
// 배열은 순서에 의미가 있으므로(예: tags, parameters) 원소 순서를 유지한다.
export function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value === null || typeof value !== 'object') return value;

  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    sorted[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
  }
  return sorted;
}
