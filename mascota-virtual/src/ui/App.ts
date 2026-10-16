/**
 * App: armazón de la interfaz (cabecera con monedas, navegación inferior,
 * pantallas, recompensa diaria, resumen offline y botón "atrás" de Android).
 */
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Clock, formatDuration } from '../core/Clock';
import { EventBus } from '../core/EventBus';
import { GameState } from '../core/GameState';
import { GameManager } from '../core/GameManager';
import { DataRegistry } from '../data/DataRegistry';
import { EconomySystem } from '../systems/economy/EconomySystem';
import { PetManager } from '../systems/pet/PetManager';
import type { OfflineReport } from '../systems/save/SaveSystem';
import { SaveSystem } from '../systems/save/SaveSystem';
import { OnlineService } from '../systems/online/OnlineService';
import { type Screen } from './common';
import { el, esc, onAction } from './dom';
import { closeTopModal, confirmModal, hasModal, showModal, showToast } from './Overlay';
import { AlbumScreen } from './screens/AlbumScreen';
import { EventsScreen } from './screens/EventsScreen';
import { FamilyScreen } from './screens/FamilyScreen';
import { HomeScreen } from './screens/HomeScreen';
import { NewPetScreen } from './screens/NewPetScreen';
import { ParkScreen } from './screens/ParkScreen';
import { Analytics } from '../systems/online/Analytics';
import { celebrate, celebrateStage } from './Celebration';
import { feedback, play, type SoundId } from './Feedback';
import { Tutorial } from './Tutorial';
import { BondSystem } from '../systems/pet/BondSystem';
import { maybeAskSupportSurvey } from './Survey';
import { PRODUCTS } from '../data/premium';
import { hasIcon, icon } from './icons';
import { PetMind } from '../systems/pet/PetMind';
import { musicEnabled, setupMusic, startMusic, stopMusic } from './Music';
import { setupDiaryAI } from './Diary';
import { ShopScreen } from './screens/ShopScreen';

/** Herramientas de prueba (adelantar el tiempo, monedas): no van en la versión de Google Play (VITE_TIENDA=1). */
const HERRAMIENTAS = import.meta.env.VITE_TIENDA !== '1';

const NAV: { id: string; icon: string; label: string; create: () => Screen }[] = [
  { id: 'home', icon: '🏠', label: 'Casa', create: () => new HomeScreen() },
  { id: 'shop', icon: '🛍️', label: 'Tienda', create: () => new ShopScreen() },
  { id: 'events', icon: '🏆', label: 'Eventos', create: () => new EventsScreen() },
  { id: 'park', icon: '🌳', label: 'Parque', create: () => new ParkScreen() },
  { id: 'family', icon: '👪', label: 'Familia', create: () => new FamilyScreen() },
  { id: 'album', icon: '📸', label: 'Álbum', create: () => new AlbumScreen() },
];

export class App {
  private shell = el('div', 'app');
  private main!: HTMLElement;
  private current: Screen | null = null;
  private currentId = 'home';

  constructor(private mountPoint: HTMLElement) {}

  start(report: OfflineReport | null): void {
    this.shell.innerHTML = `
      <header class="topbar">
        <span class="logo-sm">🐾 Patitas</span>
        <span class="wallet"><span>${icon('coin')}<b class="coins">0</b></span><span>${icon('star')}<b class="stars-w">0</b></span></span>
        <button class="icon-btn" data-act="settings" aria-label="Ajustes">${icon('settings')}</button>
      </header>
      <main class="screen"></main>
      <nav class="bottom-nav">${NAV.map((n) => `<button class="nav-btn" data-act="nav" data-id="${n.id}"><span>${hasIcon(n.id) ? icon(n.id) : n.icon}</span><small>${n.label}</small></button>`).join('')}</nav>`;
    this.mountPoint.appendChild(this.shell);
    this.main = this.shell.querySelector('.screen') as HTMLElement;

    onAction(this.shell.querySelector('.topbar') as HTMLElement, (act) => act === 'settings' && this.openSettings());
    onAction(this.shell.querySelector('.bottom-nav') as HTMLElement, (act, t) => act === 'nav' && this.go(t.dataset.id!));

    const bus = EventBus.instance;
    bus.on('economy:walletChanged', () => this.updateWallet());
    bus.on('ui:toast', ({ text, kind }) => showToast(text, kind));
    bus.on('mind:learned', ({ text }) => {
      showToast(`💡 ${text}`, 'good');
      play('happy');
    });
    bus.on('mind:word', ({ petId, word }) => {
      const pet = PetManager.instance.get(petId);
      if (pet) showToast(`📖 ${pet.name} aprendió a decir «${word}»`, 'good');
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.greet(null);
    });
    bus.on('pet:returnedHome', ({ name }) => {
      showModal({ title: '🏠 ¡Volvió a casa!', body: `<p>${esc(name)} encontró el camino de vuelta. Llega con hambre y algo sucia: dale mimos.</p>` });
    });
    bus.on('online:gift', (g) => {
      const parts = [g.coins ? `+${g.coins} 🪙` : '', g.stars ? `+${g.stars} ⭐` : '', g.item ? `🎀 ${esc(g.item)}` : ''].filter(Boolean);
      showModal({
        title: `🎁 ${esc(g.title || '¡Tienes un regalo!')}`,
        body: `<div class="result-stars">🎁</div>${g.message ? `<p class="center">${esc(g.message)}</p>` : ''}<p class="center reward">${parts.join(' · ')}</p>`,
        buttons: [{ label: '¡Gracias!', act: 'close', primary: true }],
      });
    });
    // Al elegir la primera mascota se sube enseguida (sin esperar a la siguiente sincronización)
    bus.on('pet:created', ({ reason }) => {
      if (reason === 'start') void GameManager.instance.syncOnline();
    });
    // Celebraciones, sonido y vibración (Auditoría P7)
    bus.on('pet:stageChanged', ({ petId, from, to }) => {
      const pet = PetManager.instance.get(petId);
      if (pet) celebrateStage(pet, from, to);
    });
    bus.on('pet:bondMilestone', ({ petId, level }) => {
      const pet = PetManager.instance.get(petId);
      if (pet) celebrate({ pet, title: `💞 Vínculo ${level} con ${esc(pet.name)}`, text: esc(BondSystem.textFor(level)) });
    });
    bus.on('pet:birthday', ({ petId, months }) => {
      const pet = PetManager.instance.get(petId);
      if (pet) celebrate({ pet, title: `🎂 ¡Feliz cumpleaños, ${esc(pet.name)}!`, text: `Hoy cumple ${months === 1 ? '1 mes' : `${months} meses`} contigo.` });
    });
    bus.on('collection:new', ({ petId, rare }) => {
      const pet = PetManager.instance.get(petId);
      if (pet && rare) celebrate({ pet, title: '✨ ¡Pelaje raro!', text: `${esc(pet.name)} tiene un color que muy pocos consiguen. Ya está en tu libro de pelajes.` });
    });
    bus.on('store:granted', ({ productId }) => {
      const pet = PetManager.instance.selected;
      const p = PRODUCTS.find((x) => x.id === productId);
      if (pet && p) celebrate({ pet, title: `${p.icon} ¡Gracias por tu apoyo!`, text: `Ya tienes <b>${esc(p.name)}</b>. Lo encontrarás en la tienda (Decoración) y en la mochila.` });
    });
    bus.on('breeding:born', ({ babyId }) => {
      const baby = PetManager.instance.get(babyId);
      if (baby) celebrate({ pet: baby, title: `🐣 ¡Ha nacido ${esc(baby.name)}!`, text: 'Una nueva vida en la familia. Mira de quién ha heredado los colores.' });
    });
    const SONIDO_ACCION: Record<string, SoundId> = { feed: 'eat', pet: 'pet', bathe: 'splash', play: 'happy', train: 'happy', walk: 'happy' };
    bus.on('interaction:performed', ({ actionId, coinsFound }) => {
      feedback(SONIDO_ACCION[actionId] ?? 'tap', actionId === 'pet' ? 'light' : 'medium');
      if (coinsFound) setTimeout(() => play('coin'), 250);
    });
    bus.on('economy:purchase', () => feedback('coin', 'light'));
    bus.on('game:finished', () => feedback('happy', 'success'));
    bus.on('online:gift', () => feedback('coin', 'success'));
    this.shell.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.btn, .nav-btn, .tab')) play('tap');
    });
    bus.on('adoption:completed', ({ petName, coins }) => showToast(`🤝 ${petName} encontró un nuevo hogar. +${coins} 🪙`, 'good'));

    this.updateWallet();
    setupMusic();
    setupDiaryAI();
    setInterval(() => this.current?.tick?.(), 1000);
    void GameManager.instance.syncOnline();
    this.setupBackButton();

    const recuperada = SaveSystem.instance.recoveredFrom;
    if (recuperada === 'backup') showToast('Tu partida se había dañado y se recuperó desde la copia de respaldo ✅', 'good');
    if (recuperada === 'none') {
      showModal({
        title: '😿 No se pudo abrir tu partida',
        body: '<p>Los datos guardados estaban dañados. Si tienes una copia de seguridad, puedes restaurarla en ⚙️ Ajustes › Restaurar copia.</p>',
      });
    }
    if (PetManager.instance.all().length === 0) {
      this.showNewPet();
    } else {
      this.go('home');
      if (report) this.showOfflineReport(report);
      this.greet(report);
      this.offerDaily();
      Tutorial.maybeStart();
      setTimeout(maybeAskSupportSurvey, 6000);
    }
  }

  go(id: string): void {
    const entry = NAV.find((n) => n.id === id) ?? NAV[0];
    this.shell.classList.remove('onboarding');
    this.current?.unmount?.();
    this.main.innerHTML = '';
    this.main.scrollTop = 0;
    // La casa ocupa toda la pantalla (sin márgenes ni scroll)
    this.main.classList.toggle('screen-full', entry.id === 'home');
    const screenRoot = el('div', `screen-${entry.id}`);
    this.main.appendChild(screenRoot);
    this.current = entry.create();
    this.current.mount(screenRoot);
    this.currentId = entry.id;
    this.shell.querySelectorAll<HTMLElement>('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.id === entry.id));
  }

  /** Al volver tras unas horas, la mascota te recibe (según el vínculo). Nunca reproches. */
  /**
   * Al volver, la mascota te recibe según lo que sabe de ti (PetMind): si llegas a tu hora habitual
   * te esperaba; si llevas un día fuera, te echó de menos. Nunca reproches.
   */
  private greet(_report: OfflineReport | null): void {
    const pet = PetManager.instance.selected;
    if (!pet) return;
    const v = PetMind.instance.onVisit(pet);
    const ctx = v.awayH >= 24 ? 'greet-missed' : v.expected && v.awayH >= 2 ? 'greet-expected' : v.awayH >= 3 ? 'greet' : null;
    if (!ctx) return;
    setTimeout(() => {
      EventBus.instance.emit('mind:say', { petId: pet.id, text: PetMind.instance.say(pet, ctx) });
      play('happy');
    }, 1200);
  }

  private showNewPet(): void {
    this.current?.unmount?.();
    this.shell.classList.add('onboarding');
    this.main.classList.remove('screen-full');
    this.main.innerHTML = '';
    const root = el('div');
    this.main.appendChild(root);
    this.current = new NewPetScreen(() => {
      void GameManager.instance.save();
      this.go('home');
      if (GameState.instance.data.tutorialDone) this.offerDaily();
      else Tutorial.maybeStart();
    });
    this.current.mount(root);
  }

  private updateWallet(): void {
    const eco = EconomySystem.instance;
    this.shell.querySelector('.coins')!.textContent = String(eco.coins);
    this.shell.querySelector('.stars-w')!.textContent = String(eco.stars);
  }

  private offerDaily(): void {
    if (!EconomySystem.instance.canClaimDaily()) return;
    showModal({
      title: '🎁 Recompensa diaria',
      body: '<p class="center">¡Gracias por cuidar a tus mascotas hoy! Entra cada día para aumentar tu racha.</p>',
      buttons: [{ label: '¡Recoger!', act: 'claim', primary: true }],
      onAction: (act) => {
        if (act !== 'claim') return;
        const r = EconomySystem.instance.claimDaily();
        if (r) showToast(`Día ${r.streak}: +${r.coins} 🪙${r.stars ? ` +${r.stars} ⭐` : ''}`, 'good');
      },
    });
  }

  private showOfflineReport(r: OfflineReport): void {
    if (r.offlineMs < 5 * 60 * 1000) return;
    const lines: string[] = [];
    r.stageUps.forEach((s) => lines.push(`🌱 ${esc(s.name)} creció: ahora es ${DataRegistry.instance.getStage(s.stage).name}`));
    r.escaped.forEach((n) => lines.push(`💨 ¡${esc(n)} se escapó! Ve a Casa a seguir su rastro.`));
    r.returned.forEach((n) => lines.push(`🏠 ${esc(n)} volvió sola a casa.`));
    r.changes.forEach((c) => lines.push(`${esc(c.name)}: hambre ${c.hunger >= 0 ? '+' : ''}${c.hunger}, felicidad ${c.happiness >= 0 ? '+' : ''}${c.happiness}`));
    showModal({
      title: '🕰️ Mientras no estabas...',
      body: `<p>Estuviste fuera <b>${formatDuration(r.offlineMs)}</b> (${(r.offlineMs / 3600_000).toFixed(1)} días en el juego).</p><ul class="report">${lines.map((l) => `<li>${l}</li>`).join('')}</ul>`,
    });
  }

  private openSettings(): void {
    showModal({
      title: '⚙️ Ajustes',
      className: 'settings-modal',
      body: `
        <div class="server-box">
          <b>🌐 Juego en línea</b>
          <p class="hint">Tu apodo: <b class="apodo">${esc(OnlineService.instance.player.apodo)}</b> <button class="btn btn-sm" data-act="apodo">🎲 Cambiar</button></p>
          <div class="player-id"><span>Tu ID</span><code id="player-id">${esc(OnlineService.instance.player.id)}</code><button class="btn btn-sm" data-act="copy-id">📋 Copiar</button></div>
          ${HERRAMIENTAS ? `<p class="hint">Usa este ID en la pestaña <b>Regalos</b> de la hoja (columna <b>para</b>) para enviarle un regalo a este jugador.</p>
          <label class="field"><span>URL del Apps Script (/exec)</span>
            <input id="server-url" type="url" placeholder="https://script.google.com/macros/s/.../exec" value="${esc(OnlineService.instance.url)}"/></label>
          <div class="field-row"><button class="btn btn-primary" data-act="connect">Conectar</button><span class="server-status">${serverStatus()}</span></div>` : `<p class="hint">Estado: <span class="server-status">${serverStatus()}</span></p>`}
          <label class="field-row hint"><input type="checkbox" data-act="analytics" ${Analytics.instance.enabled ? 'checked' : ''}> Enviar estadísticas anónimas de uso (ayudan a mejorar el juego)</label>
        </div>
        <p class="hint">Tu partida se guarda sola cada 10 segundos y al salir.</p>
        <div class="settings-toggles">
          <label class="field-row"><input type="checkbox" data-act="sound" ${GameState.instance.data.settings.sound ? 'checked' : ''}> 🔊 Sonidos</label>
          <label class="field-row"><input type="checkbox" data-act="haptics" ${GameState.instance.data.settings.haptics ? 'checked' : ''}> 📳 Vibración</label>
          <label class="field-row"><input type="checkbox" data-act="music" ${musicEnabled() ? 'checked' : ''}> 🎵 Música</label>
        </div>
        <div class="settings-list">
          <button class="btn" data-act="save">💾 Guardar ahora</button>
          <button class="btn" data-act="export">📤 Copia de seguridad (exportar)</button>
          <button class="btn" data-act="import">📥 Restaurar copia (importar)</button>
          <button class="btn btn-danger" data-act="reset">🗑️ Borrar partida</button>
        </div>
        ${HERRAMIENTAS ? `<details class="debug"><summary>🧪 Herramientas de prueba</summary>
          <p class="hint">Para probar el crecimiento rápido. No aparecen en la versión de Google Play.</p>
          <button class="btn btn-sm" data-act="ff1">+1 hora</button>
          <button class="btn btn-sm" data-act="ff6">+6 horas</button>
          <button class="btn btn-sm" data-act="ff24">+1 día real</button>
          <button class="btn btn-sm" data-act="coins">+1000 🪙 +20 ⭐</button>
          <button class="btn btn-sm" data-act="dbg-adult">Hacer adulta</button>
        </details>` : ''}
        <p class="hint center settings-version">Patitas v${esc(String(import.meta.env.VITE_APP_VERSION ?? ''))} · SoulDeveloperCompany</p>`,
      buttons: [{ label: 'Cerrar', act: 'close', primary: true }],
      onAction: (act, _t, modal) => {
        if (act === 'music') {
          GameState.instance.data.settings.music = (modal.body.querySelector('[data-act="music"]') as HTMLInputElement).checked;
          if (musicEnabled()) startMusic();
          else stopMusic();
          return true;
        }
        if (act === 'sound' || act === 'haptics') {
          GameState.instance.data.settings[act] = (modal.body.querySelector(`[data-act="${act}"]`) as HTMLInputElement).checked;
          return true;
        }
        if (act === 'analytics') {
          Analytics.instance.setEnabled((modal.body.querySelector('[data-act="analytics"]') as HTMLInputElement).checked);
          return true;
        }
        if (act === 'copy-id') {
          const id = OnlineService.instance.player.id;
          navigator.clipboard?.writeText(id).then(
            () => showToast('ID copiado 📋', 'good'),
            () => {
              // Si el portapapeles está bloqueado, se selecciona el texto para copiarlo a mano
              const range = document.createRange();
              range.selectNodeContents(modal.body.querySelector('#player-id')!);
              getSelection()?.removeAllRanges();
              getSelection()?.addRange(range);
              showToast('Mantén pulsado para copiar el ID');
            },
          );
          return true;
        }
        if (act === 'connect' || act === 'apodo') {
          void this.serverAction(act, modal.body);
          return true;
        }
        void this.settingsAction(act, modal.close);
        return act !== 'close' && !['reset', 'import', 'export'].includes(act);
      },
    });
  }

  /** Conectar con el servidor o cambiar el apodo. */
  private async serverAction(act: string, body: HTMLElement): Promise<void> {
    const online = OnlineService.instance;
    const status = body.querySelector('.server-status') as HTMLElement;
    if (act === 'apodo') {
      body.querySelector('.apodo')!.textContent = online.changeApodo();
      void GameManager.instance.syncOnline();
      return;
    }
    online.setUrl((body.querySelector('#server-url') as HTMLInputElement).value);
    if (!online.isConfigured()) {
      status.textContent = '⚠️ La URL debe empezar por https://script.google.com/';
      return;
    }
    status.textContent = 'Conectando…';
    const ok = await GameManager.instance.syncOnline();
    status.textContent = serverStatus();
    showToast(ok ? '🌐 Conectado al servidor' : 'No se pudo conectar. Revisa la URL y que la implementación sea "Cualquier usuario"', ok ? 'good' : 'bad');
    void GameManager.instance.save();
  }

  private async settingsAction(act: string, close: () => void): Promise<void> {
    const ff = (h: number) => {
      Clock.advance(h * 3600_000);
      GameManager.instance.tick();
      showToast(`⏩ +${h} h`, 'good');
      this.go(this.currentId);
    };
    switch (act) {
      case 'save':
        await GameManager.instance.save();
        showToast('Partida guardada 💾', 'good');
        break;
      case 'export': {
        const json = SaveSystem.instance.exportJson();
        try {
          await navigator.clipboard.writeText(json);
          showToast('Copia copiada al portapapeles 📋', 'good');
        } catch {
          showModal({ title: 'Copia de seguridad', body: `<textarea class="json-box" readonly>${esc(json)}</textarea>` });
        }
        break;
      }
      case 'import': {
        close();
        showModal({
          title: '📥 Restaurar copia',
          body: '<p class="hint">Pega aquí el texto de tu copia de seguridad.</p><textarea class="json-box"></textarea>',
          buttons: [
            { label: 'Cancelar', act: 'close' },
            { label: 'Restaurar', act: 'do-import', primary: true },
          ],
          onAction: (a, _t, m) => {
            if (a !== 'do-import') return;
            try {
              SaveSystem.instance.importJson((m.body.querySelector('textarea') as HTMLTextAreaElement).value);
              void GameManager.instance.save();
              showToast('Partida restaurada ✅', 'good');
              this.go('home');
            } catch {
              showToast('Esa copia no es válida', 'bad');
              return true;
            }
          },
        });
        break;
      }
      case 'reset': {
        close();
        if (await confirmModal('Borrar partida', '¿Seguro? Perderás todas tus mascotas y progreso. No se puede deshacer.', 'Borrar todo')) {
          await SaveSystem.instance.deleteSave();
          this.updateWallet();
          this.showNewPet();
        }
        break;
      }
      case 'ff1':
        ff(1);
        break;
      case 'ff6':
        ff(6);
        break;
      case 'ff24':
        ff(24);
        break;
      case 'dbg-adult': {
        // Solo pruebas/capturas: edad de adulta y necesidades cubiertas
        const p = PetManager.instance.selected;
        if (p) {
          p.data.ageDays = Math.max(p.data.ageDays, 7.02);
          Object.assign(p.data.stats, { happiness: 92, hunger: 12, energy: 90, hygiene: 92, health: 100 });
          ff(0.01);
        }
        break;
      }
      case 'coins':
        EconomySystem.instance.addCoins(1000);
        EconomySystem.instance.addStars(20);
        break;
    }
  }

  /** Botón "atrás" de Android: cierra modales, vuelve a Casa o sale de la app. */
  private setupBackButton(): void {
    if (!Capacitor.isNativePlatform()) return;
    void CapApp.addListener('backButton', () => {
      if (hasModal()) closeTopModal();
      else if (this.currentId !== 'home' && !this.shell.classList.contains('onboarding')) this.go('home');
      else {
        void GameManager.instance.save().then(() => CapApp.exitApp());
      }
    });
    void CapApp.addListener('pause', () => void GameManager.instance.save());
    void CapApp.addListener('resume', () => GameManager.instance.tick());
  }
}

/** Texto del estado de conexión. */
function serverStatus(): string {
  const online = OnlineService.instance;
  if (!online.isConfigured()) return '⚪ Sin configurar';
  if (online.status === 'error') return '🔴 Sin conexión';
  const last = GameState.instance.data.online.lastSync;
  return last ? `🟢 Conectado (${new Date(last).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })})` : '🟡 Sin probar';
}
