/** Ventanas modales y avisos (toasts). */
import { el, esc, onAction } from './dom';

export interface ModalButton {
  label: string;
  act: string;
  primary?: boolean;
  disabled?: boolean;
}

export interface ModalOptions {
  title: string;
  body: string;
  buttons?: ModalButton[];
  /** Se llama con el `data-act` pulsado. Devuelve true para NO cerrar el modal. */
  onAction?: (act: string, target: HTMLElement, modal: Modal) => boolean | void;
  dismissible?: boolean;
  className?: string;
}

export interface Modal {
  root: HTMLElement;
  body: HTMLElement;
  close: () => void;
}

const stack: Modal[] = [];

function layer(): HTMLElement {
  let node = document.getElementById('overlay-layer');
  if (!node) {
    node = el('div');
    node.id = 'overlay-layer';
    document.body.appendChild(node);
  }
  return node;
}

export function showModal(opts: ModalOptions): Modal {
  const backdrop = el('div', `modal-backdrop ${opts.className ?? ''}`);
  const buttons = (opts.buttons ?? [{ label: 'Cerrar', act: 'close', primary: true }])
    .map(
      (b) =>
        `<button class="btn ${b.primary ? 'btn-primary' : ''}" data-act="${esc(b.act)}" ${b.disabled ? 'disabled' : ''}>${b.label}</button>`,
    )
    .join('');
  backdrop.innerHTML = `
    <div class="modal" role="dialog">
      <div class="modal-title">${opts.title}</div>
      <div class="modal-body">${opts.body}</div>
      ${buttons ? `<div class="modal-buttons">${buttons}</div>` : ''}
    </div>`;
  const modal: Modal = {
    root: backdrop,
    body: backdrop.querySelector('.modal-body') as HTMLElement,
    close: () => {
      backdrop.remove();
      const i = stack.indexOf(modal);
      if (i >= 0) stack.splice(i, 1);
    },
  };
  onAction(backdrop, (act, target) => {
    const keep = opts.onAction?.(act, target, modal);
    if (act === 'close' || (!keep && opts.buttons?.some((b) => b.act === act))) modal.close();
  });
  if (opts.dismissible !== false) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) modal.close();
    });
  }
  layer().appendChild(backdrop);
  stack.push(modal);
  return modal;
}

/** Cierra el modal superior (botón "atrás" de Android). Devuelve false si no había ninguno. */
export function closeTopModal(): boolean {
  const top = stack[stack.length - 1];
  if (!top) return false;
  top.close();
  return true;
}

export function hasModal(): boolean {
  return stack.length > 0;
}

export function confirmModal(title: string, text: string, ok = 'Aceptar'): Promise<boolean> {
  return new Promise((resolve) => {
    let answered = false;
    const m = showModal({
      title,
      body: `<p>${text}</p>`,
      buttons: [
        { label: 'Cancelar', act: 'no' },
        { label: ok, act: 'yes', primary: true },
      ],
      onAction: (act) => {
        answered = true;
        resolve(act === 'yes');
      },
    });
    // Si se cierra tocando fuera, cuenta como "no"
    const obs = new MutationObserver(() => {
      if (!m.root.isConnected) {
        obs.disconnect();
        if (!answered) resolve(false);
      }
    });
    obs.observe(layer(), { childList: true });
  });
}

export function promptModal(title: string, label: string, value = ''): Promise<string | null> {
  return new Promise((resolve) => {
    let answered = false;
    const m = showModal({
      title,
      body: `<label class="field"><span>${label}</span><input type="text" maxlength="16" value="${esc(value)}"/></label>`,
      buttons: [
        { label: 'Cancelar', act: 'no' },
        { label: 'Aceptar', act: 'yes', primary: true },
      ],
      onAction: (act, _t, modal) => {
        answered = true;
        resolve(act === 'yes' ? (modal.body.querySelector('input') as HTMLInputElement).value.trim() : null);
      },
    });
    const input = m.body.querySelector('input') as HTMLInputElement;
    setTimeout(() => input.focus(), 50);
    const obs = new MutationObserver(() => {
      if (!m.root.isConnected) {
        obs.disconnect();
        if (!answered) resolve(null);
      }
    });
    obs.observe(layer(), { childList: true });
  });
}

/** Aviso flotante temporal. */
export function showToast(text: string, kind: 'info' | 'good' | 'bad' = 'info'): void {
  let box = document.getElementById('toasts');
  if (!box) {
    box = el('div');
    box.id = 'toasts';
    document.body.appendChild(box);
  }
  const t = el('div', `toast toast-${kind}`, esc(text));
  box.appendChild(t);
  // Máximo 3 avisos a la vez: se descartan los más antiguos
  while (box.children.length > 3) box.firstElementChild?.remove();
  setTimeout(() => t.classList.add('toast-out'), 2600);
  setTimeout(() => t.remove(), 3000);
}
