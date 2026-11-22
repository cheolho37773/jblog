import { useEffect, type RefObject } from 'react';

type ModalDialogOptions = {
  isOpen: boolean;
  /** 이 폭(px) 이상이 되면 닫는다. 그 폭부터는 이 대화상자를 여는 버튼이 사라지기 때문이다. */
  closeAtMinWidth: number;
  onRequestClose: () => void;
};

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled])';

/**
 * 모달 dialog 안에서 Tab이 맨 끝에서 맨 앞으로(Shift+Tab은 반대로) 돌게 한다.
 * 브라우저 기본 동작은 끝에서 주소창 같은 브라우저 UI로 포커스가 빠져나갈 수 있다.
 */
function trapTabFocus(event: KeyboardEvent) {
  if (event.key !== 'Tab') return;
  const dialog = event.currentTarget as HTMLDialogElement;
  const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (!first || !last) return;

  const leavingBackward = event.shiftKey && document.activeElement === first;
  const leavingForward = !event.shiftKey && document.activeElement === last;
  if (!leavingBackward && !leavingForward) return;

  event.preventDefault();
  (leavingBackward ? last : first).focus();
}

/**
 * 열림 상태(isOpen)에 맞춰 네이티브 <dialog>를 모달로 열고 닫는다.
 * 모달이면 브라우저가 바깥을 inert 처리해 포커스가 갇히고 ESC로 닫힌다.
 * 지정한 폭 이상으로 넓어지면 닫는다. 문서 스크롤 잠금은 CSS가 맡는다(root layout의 `has-[dialog[open]]:overflow-hidden`):
 * JS로 잠그면 ESC로 닫을 때 상태 반영이 늦어 잠금이 잠깐 남는다.
 */
export function useModalDialog(
  dialogRef: RefObject<HTMLDialogElement | null>,
  { isOpen, closeAtMinWidth, onRequestClose }: ModalDialogOptions,
) {
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [dialogRef, isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!isOpen || !dialog) return;
    dialog.addEventListener('keydown', trapTabFocus);
    return () => dialog.removeEventListener('keydown', trapTabFocus);
  }, [dialogRef, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const wide = window.matchMedia(`(min-width: ${closeAtMinWidth}px)`);
    const closeWhenWide = () => {
      if (wide.matches) onRequestClose();
    };
    wide.addEventListener('change', closeWhenWide);
    return () => wide.removeEventListener('change', closeWhenWide);
  }, [isOpen, closeAtMinWidth, onRequestClose]);
}
