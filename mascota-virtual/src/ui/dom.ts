/** Utilidades mínimas de DOM para la interfaz (sin frameworks, para que pese poco en Android). */

/** Escapa texto para insertarlo en plantillas HTML. */
export function esc(text: string | number): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', html = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html) node.innerHTML = html;
  return node;
}

/**
 * Delegación de eventos: llama a `handler(action, target)` cuando se toca un
 * elemento con `data-act="..."` dentro de `root`.
 */
export function onAction(root: HTMLElement, handler: (action: string, target: HTMLElement) => void): void {
  root.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!target || !root.contains(target) || target.hasAttribute('disabled')) return;
    handler(target.dataset.act!, target);
  });
}

/** Formatea un precio con iconos. */
export function priceHTML(price: { coins?: number; stars?: number }): string {
  const parts: string[] = [];
  if (price.coins) parts.push(`🪙 ${price.coins}`);
  if (price.stars) parts.push(`⭐ ${price.stars}`);
  return parts.join(' · ') || 'Gratis';
}

export function formatDate(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleDateString('es', { day: 'numeric', month: 'short' }) + ' ' +
    d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

/** Pausa (para secuencias de animación). */
export function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Cambia el innerHTML solo si es distinto (evita reiniciar animaciones y perder el foco). */
export function setHTML(node: HTMLElement, html: string): void {
  if ((node as HTMLElement & { _html?: string })._html === html) return;
  (node as HTMLElement & { _html?: string })._html = html;
  node.innerHTML = html;
}
