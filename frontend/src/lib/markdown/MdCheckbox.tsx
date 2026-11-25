import type { ComponentProps } from 'react';

/** gfm 체크리스트의 체크박스. 보기 전용이라 readOnly를 줘 React의 "onChange 없는 checked" 경고를 피한다. */
export function MdCheckbox({ checked, ...props }: ComponentProps<'input'>) {
  return <input {...props} type="checkbox" checked={Boolean(checked)} readOnly disabled />;
}
