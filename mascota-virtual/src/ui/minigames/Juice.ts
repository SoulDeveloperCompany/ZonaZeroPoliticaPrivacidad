/**
 * "Jugo" compartido de los minijuegos: combos, textos que saltan, explosiones de partículas,
 * sacudida de pantalla y modo fiebre. Hace que cada acierto/fallo se sienta (auditoría 2026-10).
 */
import { el } from '../dom';
import { blip, play, vibrate } from '../Feedback';

/** Texto que salta y se desvanece en (x, y) px dentro de `field`. */
export function popText(field: HTMLElement, x: number, y: number, text: string, cls = ''): void {
  const n = el('span', `juice-pop ${cls}`, text);
  n.style.left = `${x}px`;
  n.style.top = `${y}px`;
  field.appendChild(n);
  setTimeout(() => n.remove(), 800);
}

/** Explosión de partículas desde (x, y). */
export function burst(field: HTMLElement, x: number, y: number, emojis: string[], count = 6): void {
  for (let i = 0; i < count; i++) {
    const n = el('span', 'juice-spark', emojis[i % emojis.length]);
    const a = (Math.PI * 2 * i) / count + Math.random() * 0.6;
    const d = 40 + Math.random() * 40;
    n.style.left = `${x}px`;
    n.style.top = `${y}px`;
    n.style.setProperty('--dx', `${Math.cos(a) * d}px`);
    n.style.setProperty('--dy', `${Math.sin(a) * d - 20}px`);
    field.appendChild(n);
    setTimeout(() => n.remove(), 650);
  }
}

/** Sacudida corta (golpes y fallos). */
export function shake(node: HTMLElement, strong = false): void {
  node.classList.remove('juice-shake', 'juice-shake-strong');
  void node.offsetWidth;
  node.classList.add(strong ? 'juice-shake-strong' : 'juice-shake');
  vibrate(strong ? 'error' : 'light');
}

/** Contador de combo: cada 5 aciertos seguidos sube el multiplicador (máx. ×4). */
export class Combo {
  count = 0;
  private badge: HTMLElement;

  constructor(host: HTMLElement) {
    this.badge = el('div', 'juice-combo');
    this.badge.hidden = true;
    host.appendChild(this.badge);
  }

  get mult(): number {
    return Math.min(4, 1 + Math.floor(this.count / 5));
  }

  hit(): number {
    const before = this.mult;
    this.count++;
    blip(this.count);
    if (this.count >= 3) {
      this.badge.hidden = false;
      this.badge.textContent = `¡Combo ${this.count}!${this.mult > 1 ? ` ×${this.mult}` : ''}`;
      this.badge.classList.remove('bump');
      void this.badge.offsetWidth;
      this.badge.classList.add('bump');
    }
    if (this.mult > before) {
      play('level');
      vibrate('success');
    }
    return this.mult;
  }

  miss(): void {
    if (this.count >= 3) {
      this.badge.classList.add('broken');
      setTimeout(() => this.badge.classList.remove('broken'), 400);
    }
    this.count = 0;
    setTimeout(() => {
      if (this.count === 0) this.badge.hidden = true;
    }, 400);
  }
}

/** Aviso grande en el centro ("¡FIEBRE!", "¡Más rápido!"). */
export function banner(field: HTMLElement, text: string, cls = ''): void {
  const n = el('div', `juice-banner ${cls}`, text);
  field.appendChild(n);
  setTimeout(() => n.remove(), 1300);
}
