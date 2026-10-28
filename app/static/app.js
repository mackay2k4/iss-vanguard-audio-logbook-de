// ============================================================
// ISS Vanguard Logbuch — Frontend SPA
// ============================================================
'use strict';

// ---- State ----
let state = {
  user: null,               // {username, activeSavegameId, savegames}
  contentIndex: null,       // [{id, number, variant, order, title, hasAudio}]
  currentProtocolId: null,  // string
  currentProtocol: null,    // full protocol object
  checks: {},               // {itemId: true} for active savegame
  notes: {},                // {noteId: text} for active savegame
  activeSavegameId: null,   // int or null
};

// ---- User settings (persisted in localStorage) ----
// showText: whether the narrative text block is shown. The audio player and the
// instruction image are ALWAYS shown regardless. Defaults to true.
const SETTINGS_KEY = 'iss-vanguard-settings';
// viewMode: 'auto' | 'mobile' | 'desktop'. 'auto' uses a mobile layout on
// narrow screens (phones), the regular layout otherwise.
const DEFAULT_SETTINGS = { showText: true, viewMode: 'auto' };

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (_e) { /* ignore corrupt settings */ }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (_e) { /* ignore */ }
}

let settings = loadSettings();

// Apply the chosen view mode by toggling a single class on <html>: the CSS
// mobile layout keys entirely off html.view-mobile. 'mobile'/'desktop' force it;
// 'auto' resolves via screen width (and re-evaluates on resize/rotate).
const _mobileMQ = window.matchMedia('(max-width: 640px)');
function applyViewMode() {
  const el = document.documentElement;
  let mobile;
  if (settings.viewMode === 'mobile') mobile = true;
  else if (settings.viewMode === 'desktop') mobile = false;
  else mobile = _mobileMQ.matches;   // auto
  el.classList.toggle('view-mobile', mobile);
}
// Re-evaluate 'auto' when the viewport crosses the breakpoint.
_mobileMQ.addEventListener('change', () => {
  if ((settings.viewMode || 'auto') === 'auto') applyViewMode();
});

// ---- Semantic inline-icon vocabulary ----
// The content model embeds game symbols as [icon:KEY] at their exact position
// in the text. Each key renders as a compact labelled chip whose glyph + colour
// + tooltip convey the symbol's meaning. Keys match dev/icon_vocab.json.
const ICONS = {
  section_recon:       { glyph: 'A',  label: 'Aufklärung',          cls: 'recon' },
  section_security:    { glyph: 'S',  label: 'Sicherheit',          cls: 'security' },
  section_science:     { glyph: 'W',  label: 'Wissenschaft',        cls: 'science' },
  section_engineering: { glyph: 'T',  label: 'Technik',             cls: 'engineering' },
  changeling:          { glyph: 'W',  label: 'Wandlungsfähigkeit',  cls: 'neutral' },
  discovery:           { glyph: '◈',  label: 'Entdeckung',          cls: 'discovery' },
  lead:                { glyph: '⌕',  label: 'Hinweis',             cls: 'lead' },
  supply:              { glyph: '▣',  label: 'Vorräte',             cls: 'resource' },
  cube:                { glyph: '◼',  label: 'Würfel/Energie',      cls: 'resource' },
  mineral:             { glyph: '◆',  label: 'Mineral',             cls: 'resource' },
  flora:               { glyph: '❧',  label: 'Flora',               cls: 'resource' },
  fauna:               { glyph: '∿',  label: 'Fauna/Probe',         cls: 'resource' },
  wound:               { glyph: '✚',  label: 'Verletzung',          cls: 'danger' },
  death:               { glyph: '☠',  label: 'Tod',                 cls: 'danger' },
  honor:               { glyph: '★',  label: 'Ehre',                cls: 'honor' },
  success:             { glyph: '⤒',  label: 'Erfolgs-Marker',      cls: 'honor' },
  die_vanguard:        { glyph: '⬢',  label: 'Vanguard-Würfel',     cls: 'die' },
  die_basic:           { glyph: '⬡',  label: 'Basis-Würfel',        cls: 'die' },
  die_accident:        { glyph: '⬣',  label: 'Pannen-Würfel',       cls: 'die' },
  action:              { glyph: '➤',  label: 'Aktion',              cls: 'neutral' },
  alert:               { glyph: '⚠',  label: 'Gefahr',              cls: 'danger' },
  alien:               { glyph: '☄',  label: 'Alien',               cls: 'danger' },
  crew:                { glyph: '☺',  label: 'Besatzungsmitglied',  cls: 'neutral' },
  sleep:               { glyph: '☾',  label: 'Ruhe',                cls: 'neutral' },

  // ---- Icons legend (Schiffsbuch) ----
  // Cost / requirement
  die_any:             { glyph: '◧',  label: 'Sektionswürfel (beliebige Farbe)', cls: 'die' },
  die_red:             { glyph: 'R',  label: 'Sektionswürfel Rot',   cls: 'security' },
  die_green:           { glyph: 'G',  label: 'Sektionswürfel Grün',  cls: 'recon' },
  die_blue:            { glyph: 'B',  label: 'Sektionswürfel Blau',  cls: 'science' },
  die_spend:           { glyph: '⤳',  label: 'Würfel einsetzen',     cls: 'die' },
  die_sacrifice:       { glyph: '⊘',  label: 'Würfel opfern',        cls: 'danger' },
  // Planet board
  no_movement:         { glyph: '⊘',  label: 'Keine Bewegung',       cls: 'danger' },
  no_save:             { glyph: '⊠',  label: 'Nicht speichern',      cls: 'neutral' },
  final_poi:           { glyph: '⚑',  label: 'Finaler POI',          cls: 'neutral' },
  important:           { glyph: '⌄',  label: 'Wichtig',              cls: 'honor' },
  lander:              { glyph: '⏏',  label: 'Lander',               cls: 'neutral' },
  // Special effects
  immediate:           { glyph: '▮',  label: 'Sofortiger Effekt',    cls: 'danger' },
  track_progress:      { glyph: '▶',  label: 'Spur-Fortschritt',     cls: 'resource' },
  track_reduce:        { glyph: '◀',  label: 'Spur-Reduktion',       cls: 'danger' },
  // Other
  energy:              { glyph: '⚡',  label: 'Energiekosten',        cls: 'honor' },
  energy_token:        { glyph: '⚡',  label: 'Energie-Marker',       cls: 'honor' },
  command_token:       { glyph: '✪',  label: 'Kommando-Marker',      cls: 'die' },
  special_action:      { glyph: '➜',  label: 'Spezialaktion (1×/Zug)', cls: 'neutral' },
  lead_recycle:        { glyph: '↻',  label: 'Hinweis zurücklegen',  cls: 'lead' },
  rank:                { glyph: '⋀',  label: 'Rang',                 cls: 'die' },
  crew_assignment:     { glyph: '⤓',  label: 'Besatzung einsetzen',  cls: 'danger' },

  unknown:             { glyph: '◻',  label: 'Symbol',              cls: 'neutral' },
};

function iconHtml(key) {
  const def = ICONS[key] || ICONS.unknown;
  const title = esc(def.label);
  // Render the icon as its NAME in brackets (text), e.g. "[Erfolgs-Marker]".
  // No glyphs, no images — just the readable label.
  return `<span class="game-icon-name">[${title}]</span>`;
}

// ---- BroadcastChannel (cross-tab reuse) ----
const channel = new BroadcastChannel('iss-vanguard-audio');
let isPlayerTab = false;

// ---- DOM refs (resolved after DOMContentLoaded) ----
let $loginScreen, $appShell, $loginForm, $loginError,
    $headerUsername, $logoutBtn, $navFortschritt, $navEinstellungen, $navDokumente, $navPlaneten,
    $navBurger, $headerNav,
    $savegameBar, $savegameSelect, $newSavegameBtn, $deleteSavegameBtn,
    $noSavegameInfo, $createFirstSavegameBtn,
    $jumpInput, $jumpBtn, $jumpError, $prevBtn, $nextBtn,
    $mainContent,
    $createSavegameDialog, $newSavegameName, $createSavegameConfirm,
    $createSavegameCancel, $createSavegameError;

// ============================================================
// Utility helpers
// ============================================================

async function api(method, path, body) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    if (body instanceof URLSearchParams) {
      opts.body = body;
    } else {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
  }
  const resp = await fetch(path, opts);
  return resp;
}

function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }

function navigate(path) {
  history.pushState(null, '', path);
  handleRoute(path);
  if (window._issCloseNav) window._issCloseNav();   // dismiss mobile menu
}

// Parse protocol id from jump-box or URL
// Accepts: "258", "905 A", "905_A", "905a"
function parseProtocolId(raw) {
  const m = raw.trim().match(/^(\d+)\s*[_\s]?([A-Fa-f])?$/);
  if (!m) return null;
  const num = m[1];
  const letter = m[2] ? m[2].toUpperCase() : null;
  return letter ? `${parseInt(num)}_${letter}` : String(parseInt(num));
}

// Navigate to the protocol before/after the current one, by PROTOCOL NUMBER
// (not the logbook's physical reading order). Split protocols sort by number
// then variant letter (e.g. 905 → 905_A → 905_B). delta = -1 prev, +1 next;
// clamped at the ends.
function protoSortKey(p) {
  // variant: null sorts before 'A'..'F'
  const v = p.variant ? p.variant.charCodeAt(0) - 64 : 0; // A=1..F=6, base=0
  return p.number * 100 + v;
}

function navigateRelative(delta) {
  const idx = state.contentIndex;
  if (!idx || !idx.length) return;
  const sorted = [...idx].sort((a, b) => protoSortKey(a) - protoSortKey(b));

  let curId = state.currentProtocolId
    || (state.currentProtocol && state.currentProtocol.id)
    || null;

  let pos;
  if (curId === null) {
    pos = delta > 0 ? -1 : sorted.length;  // nothing open: ▶ first, ◀ last
  } else {
    pos = sorted.findIndex(p => p.id === curId);
    if (pos === -1) {
      // current id not in index (shouldn't happen) — fall back to first/last
      pos = delta > 0 ? -1 : sorted.length;
    }
  }
  const target = sorted[pos + delta];
  if (target) navigate(`/p/${target.id}`);
}

// ============================================================
// Auth
// ============================================================

async function checkAuth() {
  const resp = await api('GET', '/api/me');
  if (resp.status === 401) return null;
  if (!resp.ok) return null;
  return await resp.json();
}

async function doLogin(username, password) {
  const body = new URLSearchParams({ username, password });
  const resp = await api('POST', '/api/login', body);
  return resp.ok;
}

async function doLogout() {
  await api('POST', '/api/logout');
  state.user = null;
  state.contentIndex = null;
  state.activeSavegameId = null;
  showLoginScreen();
}

// ============================================================
// Bootstrap
// ============================================================

async function bootstrap() {
  const user = await checkAuth();
  if (!user) {
    showLoginScreen();
    return;
  }
  await onAuthenticated(user);
}

async function onAuthenticated(user) {
  state.user = user;
  state.activeSavegameId = user.activeSavegameId || null;

  // Load content index
  const resp = await api('GET', '/api/content');
  if (!resp.ok) { showLoginScreen(); return; }
  state.contentIndex = await resp.json();

  showAppShell();
  renderSavegameBar();
  updateHeaderUsername();

  // Handle initial URL
  handleRoute(window.location.pathname);
}

// ============================================================
// UI Screens
// ============================================================

function showLoginScreen() {
  hide($appShell);
  show($loginScreen);
  hide($loginError);
}

function showAppShell() {
  hide($loginScreen);
  show($appShell);
}

function updateHeaderUsername() {
  if (state.user) $headerUsername.textContent = state.user.username;
}

// ============================================================
// Savegame bar
// ============================================================

function renderSavegameBar() {
  const savegames = state.user ? state.user.savegames : [];
  const $savegameInfo = document.getElementById('savegame-info');

  if (savegames.length === 0) {
    hide($savegameInfo);
    show($noSavegameInfo);
    return;
  }

  show($savegameInfo);
  hide($noSavegameInfo);

  $savegameSelect.innerHTML = '';
  for (const sg of savegames) {
    const opt = document.createElement('option');
    opt.value = sg.id;
    opt.textContent = sg.name;
    if (sg.id === state.activeSavegameId) opt.selected = true;
    $savegameSelect.appendChild(opt);
  }
}

async function refreshUserAndSavegames() {
  const resp = await api('GET', '/api/me');
  if (resp.ok) {
    state.user = await resp.json();
    state.activeSavegameId = state.user.activeSavegameId || null;
    renderSavegameBar();
  }
}

// ============================================================
// Routing
// ============================================================

function handleRoute(path) {
  if (path === '/fortschritt') {
    renderFortschritt();
    return;
  }
  if (path === '/einstellungen') {
    renderSettings();
    return;
  }
  if (path === '/dokumente') {
    renderDokumente();
    return;
  }
  if (path === '/planeten') {
    renderPlanetIndex();
    return;
  }
  const planetMatch = path.match(/^\/planet\/(.+)/);
  if (planetMatch) {
    renderPlanetSheet(decodeURIComponent(planetMatch[1]));
    return;
  }
  // Handle /play/{id} (legacy / BroadcastChannel compatibility)
  const playMatch = path.match(/^\/play\/(.+)/);
  if (playMatch) {
    const id = parseProtocolId(playMatch[1]);
    if (id) { loadProtocol(id); return; }
  }
  // Handle /p/{id}
  const pMatch = path.match(/^\/p\/(.+)/);
  if (pMatch) {
    loadProtocol(pMatch[1]);
    return;
  }
  // Default: welcome message
  $mainContent.innerHTML = '<p style="color:var(--text-dim);padding:2rem 0;">Wähle ein Protokoll aus.</p>';
}

window.addEventListener('popstate', () => {
  handleRoute(window.location.pathname);
});

// ============================================================
// Protocol view (Tasks 4.3, 4.4, 4.5, 4.6)
// ============================================================

async function loadProtocol(id) {
  state.currentProtocolId = id;
  const resp = await api('GET', `/api/content/protocol/${encodeURIComponent(id)}`);
  if (!resp.ok) {
    $mainContent.innerHTML = `<p class="error">Protokoll ${esc(id)} nicht gefunden.</p>`;
    return;
  }
  const protocol = await resp.json();
  state.currentProtocol = protocol;

  // Update URL
  history.replaceState(null, '', `/p/${id}`);

  // Fetch checklist + note state if we have an active savegame
  state.checks = {};
  state.notes = {};
  if (state.activeSavegameId) {
    const cr = await api('GET', `/api/savegames/${state.activeSavegameId}/checks`);
    if (cr.ok) state.checks = await cr.json();
    const nr = await api('GET', `/api/savegames/${state.activeSavegameId}/notes`);
    if (nr.ok) state.notes = await nr.json();
  }

  renderProtocol(protocol);
}

function renderProtocol(protocol) {
  // Sync the centered jump input to the protocol we're actually viewing
  // (so arrows / link navigation update the number shown in the middle).
  if ($jumpInput) {
    $jumpInput.value = protocol.variant
      ? `${protocol.number} ${protocol.variant}`
      : String(protocol.number);
  }

  const html = [];
  html.push(`<h2 class="protocol-title">${esc(protocol.title)}</h2>`);

  // Audio player (Task 4.5)
  if (protocol.hasAudio) {
    html.push(renderAudioPlayer(protocol));
  }

  // Narrative text (authoritative curated transcript) + the pixel-perfect
  // instruction image cropped from the logbook (diagrams/icons/layout intact).
  // The narrative text is shown only when settings.showText is enabled; the
  // audio player (above) and the instruction image are always shown.
  const showText = settings.showText && protocol.text && protocol.text.trim();
  const hasInstrText = protocol.instructions && protocol.instructions.trim();
  const hasImage = !!protocol.instructionImage;
  // Legacy text instructions are only shown when there is NO instruction image.
  const showLegacyInstr = !hasImage && hasInstrText;
  // Only render the text box when it will actually contain something (avoids an
  // empty box when the text part is hidden and the image lives in its own row).
  if (showText || showLegacyInstr) {
    let proseHtml = '';
    if (showText) {
      proseHtml += `<div class="narrative">${formatProse(protocol.text)}</div>`;
    }
    if (showLegacyInstr) {
      if (showText) proseHtml += `<hr class="prose-divider">`;
      proseHtml += `<div class="game-instructions">${formatInstructions(protocol.instructions)}</div>`;
    }
    html.push(`<div class="text-display">${proseHtml}</div>`);
  }

  // Interactive diagram with per-hotspot free-text notes (e.g. P999). Rendered
  // natively: a landscape diagram image with an SVG overlay of textareas, one
  // per block. Text is shown INLINE on the diagram and persisted per savegame
  // in the DB (same /notes API as the P880 section notes). Fully replaces the
  // cropped instruction image for this protocol.
  if (protocol.widget && protocol.widget.widget === 'diagramNotes') {
    html.push(`<div id="diagram-notes" class="diagram-notes"></div>`);
    $mainContent.innerHTML = html.join('');
    if (protocol.hasAudio) bindAudioPlayer(protocol);
    renderDiagramNotes(protocol);
    return;
  }

  // Instruction image + progress panel (checklist and/or text-field widget),
  // laid out side by side (image left, panel right). Stacks on narrow screens.
  const hasChecklist = protocol.checklist && protocol.checklist.length > 0;
  const hasTextfields = protocol.widget && protocol.widget.widget === 'textfields';
  const hasImageRefs = protocol.imageRefs && protocol.imageRefs.length > 0;
  if (hasImage || hasChecklist || hasTextfields || hasImageRefs) {
    let row = '<div class="image-with-progress">';
    if (hasImage) {
      const src = `/static/instructions/${encodeURIComponent(protocol.instructionImage)}`;
      const rotCls = protocol.rotateImageCCW === 90 ? ' instruction-image--rot90ccw' : '';
      const hasOverlay = protocol.diagramOverlay && protocol.diagramOverlay.markers
        && protocol.diagramOverlay.markers.length > 0;
      const imgTag = `<img src="${src}" alt="Spielanweisungen Protokoll ${esc(String(protocol.number))}" loading="lazy">`;
      if (hasOverlay) {
        // Clickable X-markers positioned on the diagram nodes. Each marker is
        // tied to a check item (same state as the Fortschritt panel) so a click
        // here toggles there and vice versa. The img + svg share a tight
        // inline-block wrapper so the overlay lines up exactly with the image.
        row += `<div class="instruction-image${rotCls}">`
          + `<div class="diagram-overlay-wrap">`
          + imgTag + renderDiagramOverlay(protocol.diagramOverlay)
          + `</div></div>`;
      } else {
        row += `<div class="instruction-image${rotCls}">${imgTag}</div>`;
      }
    }
    let panel = '';
    if (hasChecklist) panel += renderChecklist(protocol.checklist, protocol.checklistTitle);
    if (hasTextfields) panel += renderTextfields(protocol);
    if (hasImageRefs) panel += renderImageRefs(protocol.imageRefs);
    if (panel) row += `<div class="progress-panel">${panel}</div>`;
    row += '</div>';
    html.push(row);
  }

  $mainContent.innerHTML = html.join('');

  // Bind audio player events
  if (protocol.hasAudio) {
    bindAudioPlayer(protocol);
  }

  // Bind checklist events
  if (protocol.checklist && protocol.checklist.length > 0) {
    bindChecklist(protocol.checklist);
  }

  // Bind the diagram X-marker overlay (e.g. P55). Shares check state with the
  // checklist, so bind AFTER the checklist so both stay in sync on this page.
  if (protocol.diagramOverlay && protocol.diagramOverlay.markers
      && protocol.diagramOverlay.markers.length > 0) {
    bindDiagramOverlay(protocol);
  }

  // Bind text-field widget events (e.g. P880 section notes)
  if (protocol.widget && protocol.widget.widget === 'textfields') {
    bindTextfields(protocol);
  }
}

// ---- Clickable diagram overlay with X-markers (e.g. P55) ----

// Renders an SVG sized to the instruction image (viewBox = image pixels) with
// one clickable marker per node. A set check item shows a red X; the marker
// outline reflects hover/checked. Markers are tied to the node check items so
// state is shared with the checklist and the Fortschritt grid.
function renderDiagramOverlay(overlay) {
  const vb = overlay.viewBox || '0 0 1000 1000';
  const marks = overlay.markers.map(m => {
    const on = !!state.checks[m.itemId];
    const safeId = m.itemId.replace(/"/g, '&quot;');
    const r = m.r;
    const shape = m.shape === 'square'
      ? `<rect x="${m.x - r}" y="${m.y - r}" width="${2 * r}" height="${2 * r}" rx="6" class="ov-hit"/>`
      : `<circle cx="${m.x}" cy="${m.y}" r="${r}" class="ov-hit"/>`;
    // X mark (two crossing strokes), shown only when checked.
    const d = r * 0.62;
    const x1 = m.x - d, y1 = m.y - d, x2 = m.x + d, y2 = m.y + d;
    const xmark = `<g class="ov-x" style="${on ? '' : 'display:none'}">`
      + `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`
      + `<line x1="${x1}" y1="${y2}" x2="${x2}" y2="${y1}"/></g>`;
    return `<g class="ov-marker${on ? ' is-on' : ''}" data-item-id="${safeId}"
             role="button" tabindex="0" aria-pressed="${on}">${shape}${xmark}</g>`;
  }).join('');
  return `<svg class="diagram-overlay" viewBox="${esc(vb)}" preserveAspectRatio="none">${marks}</svg>`;
}

function bindDiagramOverlay(protocol) {
  const svg = document.querySelector('.diagram-overlay');
  if (!svg) return;
  svg.querySelectorAll('.ov-marker').forEach(g => {
    const itemId = g.dataset.itemId;
    const toggle = async () => {
      if (!state.activeSavegameId) return;
      const newVal = !state.checks[itemId];
      // optimistic
      if (newVal) state.checks[itemId] = true; else delete state.checks[itemId];
      applyOverlayMarker(g, newVal);
      try {
        const resp = await api(
          'PUT',
          `/api/savegames/${state.activeSavegameId}/checks/${encodeURIComponent(itemId)}`,
          { checked: newVal }
        );
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        if (data.checked) state.checks[itemId] = true; else delete state.checks[itemId];
        applyOverlayMarker(g, data.checked);
        // keep the side checklist checkbox (if present) in sync
        syncChecklistCheckbox(itemId, data.checked);
      } catch (_e) {
        // revert
        if (newVal) delete state.checks[itemId]; else state.checks[itemId] = true;
        applyOverlayMarker(g, !!state.checks[itemId]);
      }
    };
    g.addEventListener('click', toggle);
    g.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
  });
}

function applyOverlayMarker(g, on) {
  g.classList.toggle('is-on', !!on);
  g.setAttribute('aria-pressed', on ? 'true' : 'false');
  const x = g.querySelector('.ov-x');
  if (x) x.style.display = on ? '' : 'none';
}

// Reflect a check change into a checklist checkbox on the same page (if the
// checklist panel is also showing this item), so overlay and list stay synced.
function syncChecklistCheckbox(itemId, checked) {
  const row = document.querySelector(`.checklist-item[data-item-id="${CSS.escape(itemId)}"]`);
  if (row) {
    const cb = row.querySelector('input[type="checkbox"]');
    if (cb) cb.checked = !!checked;
  }
}

// Reflect a check change into a diagram overlay marker (if one is on-page).
function syncOverlayMarker(itemId, checked) {
  const g = document.querySelector(`.ov-marker[data-item-id="${CSS.escape(itemId)}"]`);
  if (g) applyOverlayMarker(g, !!checked);
}

// ---- Text-field widget (free-text, persisted per savegame) ----

function noteId(protocol, field) {
  return `${protocol.id}-note-${field}`;
}

function renderTextfields(protocol) {
  const fields = protocol.widget.fields || [];
  const disabled = state.activeSavegameId ? '' : 'disabled';
  const hint = state.activeSavegameId
    ? ''
    : '<p class="checklist-hint">Savegame auswählen, um Eingaben zu speichern.</p>';
  const rows = fields.map(f => {
    const id = noteId(protocol, f);
    const val = esc(state.notes[id] || '');
    const inputId = `note-${id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    return `
      <div class="textfield-row">
        <label for="${inputId}">${esc(f)}</label>
        <textarea id="${inputId}" data-note-id="${esc(id)}" rows="2" ${disabled}>${val}</textarea>
        <span class="save-error hidden"></span>
      </div>`;
  }).join('');
  return `<div class="textfields"><h3 class="checklist-title">Notizen</h3>${hint}${rows}</div>`;
}

function bindTextfields(protocol) {
  document.querySelectorAll('.textfields textarea[data-note-id]').forEach(ta => {
    let timer = null;
    const save = async () => {
      if (!state.activeSavegameId) return;
      const id = ta.dataset.noteId;
      const text = ta.value;
      state.notes[id] = text;
      const errEl = ta.parentElement.querySelector('.save-error');
      try {
        const r = await api(
          'PUT',
          `/api/savegames/${state.activeSavegameId}/notes/${encodeURIComponent(id)}`,
          { text }
        );
        if (!r.ok) throw new Error('save failed');
        if (errEl) errEl.classList.add('hidden');
      } catch (_e) {
        if (errEl) { errEl.textContent = 'Nicht gespeichert'; errEl.classList.remove('hidden'); }
      }
    };
    // Debounce typing; also save on blur.
    ta.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(save, 700);
    });
    ta.addEventListener('blur', () => { clearTimeout(timer); save(); });
  });
}

// ---- Interactive diagram notes (e.g. P999) ----

// A diagram image + SVG overlay of per-hotspot textareas. The geometry
// (viewBox + hotspot rects) is fetched from the protocol's hotspotsUrl; the
// image from diagramImageUrl. Each hotspot's text is a DB note keyed
// `<protocolId>-note-<HOTSPOT NAME>` so it persists per savegame via the same
// /notes API used by the P880 section notes. Text is shown INLINE in the block.
// A single horizontal nudge (NUDGE_X, in viewBox units) corrects the small
// rightward offset between the printed boxes and the overlay.
const DIAGRAM_NUDGE_X = -14;   // shift overlay left to sit on the printed boxes
const DIAGRAM_NUDGE_Y = 0;
// The top of each printed block holds the icon + star-system headline. Start
// the writable textarea BELOW that header row so typing lands on the lines
// (viewBox units; blocks are ~171 units tall).
const DIAGRAM_HEADER_H = 46;

function diagramNoteId(protocol, name) {
  return `${protocol.id}-note-${name}`;
}

async function renderDiagramNotes(protocol) {
  const host = document.getElementById('diagram-notes');
  if (!host) return;

  let geom;
  try {
    const r = await fetch(protocol.hotspotsUrl);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    geom = await r.json();
  } catch (_e) {
    host.innerHTML = '<p class="error">Diagramm konnte nicht geladen werden.</p>';
    return;
  }

  const vbW = geom.vbW, vbH = geom.vbH;
  const disabled = state.activeSavegameId ? '' : 'disabled';
  const hint = state.activeSavegameId
    ? ''
    : '<p class="checklist-hint">Savegame auswählen, um Notizen zu speichern.</p>';

  // 'input' style (e.g. the ISSMAP tech-tree): thin single-line fields that
  // exactly fill their white box — no header inset, no x-nudge. Default style
  // (old boxes) insets the text below the printed headline row.
  const inputStyle = protocol.widget && protocol.widget.fieldStyle === 'input';

  // Build the SVG overlay. Each hotspot is a foreignObject holding a textarea
  // that shows the stored note text directly inside the block/field.
  const boxes = geom.hotspots.map(hs => {
    const id = diagramNoteId(protocol, hs.name);
    const val = state.notes[id] || '';
    let x, y, boxH;
    if (inputStyle) {
      x = hs.x; y = hs.y; boxH = hs.h;
    } else {
      x = hs.x + DIAGRAM_NUDGE_X;
      const headerH = Math.min(DIAGRAM_HEADER_H, Math.max(0, hs.h - 40));
      y = hs.y + DIAGRAM_NUDGE_Y + headerH;
      boxH = hs.h - headerH;
    }
    const cls = inputStyle ? 'diagram-note diagram-note--input' : 'diagram-note';
    return `
      <foreignObject x="${x}" y="${y}" width="${hs.w}" height="${boxH}">
        <textarea xmlns="http://www.w3.org/1999/xhtml"
          class="${cls}" data-note-id="${esc(id)}"
          title="${esc(hs.name)}" placeholder=""
          ${disabled}>${esc(val)}</textarea>
      </foreignObject>`;
  }).join('');

  // Clickable dash toggles: each printed "—" cost marker can be flipped to "+".
  // State stored per savegame as a note ("+" = plus, empty = dash). When "+",
  // we cover the baked-in dash with a small box and draw a "+".
  const dashes = (geom.dashToggles || []).map(dt => {
    const id = diagramNoteId(protocol, dt.id);
    const on = (state.notes[id] || '').trim() === '+';
    const cx = dt.x + dt.w / 2, cy = dt.y + dt.h / 2;
    const cover = on
      ? `<rect x="${dt.x}" y="${dt.y}" width="${dt.w}" height="${dt.h}" rx="2" class="dash-cover"/>`
        + `<text x="${cx}" y="${cy}" class="dash-plus" text-anchor="middle" dominant-baseline="central">+</text>`
      : '';
    return `<g class="dash-toggle${on ? ' is-plus' : ''}" data-note-id="${esc(id)}"
             role="button" tabindex="0" aria-pressed="${on}">`
      + `<rect x="${dt.x}" y="${dt.y}" width="${dt.w}" height="${dt.h}" class="dash-hit"/>`
      + cover + `</g>`;
  }).join('');

  // Clickable planet-title links: each node title opens that planet's record
  // sheet (/planet/<slug>).
  const planetLinks = (geom.planetLinks || []).map(pl => {
    return `<a class="planet-link" href="/planet/${esc(pl.slug)}"
      onclick="event.preventDefault();window.ispApp.navigate('/planet/${esc(pl.slug)}')">`
      + `<rect x="${pl.x}" y="${pl.y}" width="${pl.w}" height="${pl.h}" rx="3"/></a>`;
  }).join('');

  host.innerHTML = `
    ${hint}
    <div class="diagram-notes__canvas" style="aspect-ratio:${vbW} / ${vbH};">
      <img class="diagram-notes__img" src="${esc(protocol.diagramImageUrl)}"
           alt="Protokoll ${esc(String(protocol.number))} Diagramm" loading="lazy">
      <svg class="diagram-notes__svg" viewBox="0 0 ${vbW} ${vbH}" preserveAspectRatio="none">
        ${planetLinks}
        ${dashes}
        ${boxes}
      </svg>
    </div>`;

  bindDiagramNotes(protocol);
  bindDashToggles(protocol);
}

function bindDashToggles(protocol) {
  document.querySelectorAll('.dash-toggle[data-note-id]').forEach(g => {
    const id = g.dataset.noteId;
    const toggle = async () => {
      if (!state.activeSavegameId) return;
      const nowPlus = (state.notes[id] || '').trim() === '+';
      const newVal = nowPlus ? '' : '+';
      state.notes[id] = newVal;
      applyDashToggle(g, newVal === '+');
      try {
        const r = await api(
          'PUT',
          `/api/savegames/${state.activeSavegameId}/notes/${encodeURIComponent(id)}`,
          { text: newVal }
        );
        if (!r.ok) throw new Error('save failed');
      } catch (_e) {
        // revert
        state.notes[id] = nowPlus ? '+' : '';
        applyDashToggle(g, nowPlus);
      }
    };
    g.addEventListener('click', toggle);
    g.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
  });
}

// Rebuild a dash toggle's visual (cover box + "+") for the given state.
function applyDashToggle(g, on) {
  g.classList.toggle('is-plus', !!on);
  g.setAttribute('aria-pressed', on ? 'true' : 'false');
  g.querySelectorAll('.dash-cover, .dash-plus').forEach(el => el.remove());
  if (on) {
    const hit = g.querySelector('.dash-hit');
    const x = +hit.getAttribute('x'), y = +hit.getAttribute('y');
    const w = +hit.getAttribute('width'), h = +hit.getAttribute('height');
    const NS = 'http://www.w3.org/2000/svg';
    const rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('x', x); rect.setAttribute('y', y);
    rect.setAttribute('width', w); rect.setAttribute('height', h);
    rect.setAttribute('rx', '2');
    rect.setAttribute('class', 'dash-cover');
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('x', x + w / 2); t.setAttribute('y', y + h / 2);
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('dominant-baseline', 'central');
    t.setAttribute('class', 'dash-plus');
    t.textContent = '+';
    g.appendChild(rect); g.appendChild(t);
  }
}

function bindDiagramNotes(protocol) {
  document.querySelectorAll('.diagram-note[data-note-id]').forEach(ta => {
    let timer = null;
    const save = async () => {
      if (!state.activeSavegameId) return;
      const id = ta.dataset.noteId;
      const text = ta.value;
      state.notes[id] = text;
      // reflect "has content" styling immediately
      ta.classList.toggle('has-text', !!text.trim());
      try {
        const r = await api(
          'PUT',
          `/api/savegames/${state.activeSavegameId}/notes/${encodeURIComponent(id)}`,
          { text }
        );
        if (!r.ok) throw new Error('save failed');
        ta.classList.remove('save-failed');
      } catch (_e) {
        ta.classList.add('save-failed');
      }
    };
    // initial styling
    ta.classList.toggle('has-text', !!ta.value.trim());
    ta.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(save, 600);
    });
    ta.addEventListener('blur', () => { clearTimeout(timer); save(); });
  });
}

// ---- Task 4.4: Prose formatting ----

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatProse(text) {
  // Port the regex pipeline from the old docker/html/index.html
  let html = text.trim()
    // Sound effects: *** text *** -> styled span
    .replace(/\*\*\*\s*(.+?)\s*\*\*\*/g, '<span class="sfx">*** $1 ***</span>')
    // STRENG GEHEIM -> red
    .replace(/STRENG GEHEIM/g, '<span class="classified">STRENG GEHEIM</span>')
    // Report titles -> green
    .replace(
      /^((?:Außenteam-Erkundungsbericht|Einsatzbericht|Erkundungsbericht|Forschungsbericht|Logbuch des Captains|Persönliches Tagebuch|Operatorbericht|Besucherwelt:|Audioprotokoll|Sprachrekorderdaten|Außenteam-Privatkanal|Studien|Tagebuch|Projekt\s+"[^"]+").*)$/gm,
      '<span class="report-title">$1</span>'
    )
    // Speaker tags: [Name]: -> bold accent
    .replace(/\[([^\]]+)\]:/g, '<span class="speaker">[$1]:</span>')
    // Double newlines -> paragraph breaks
    .replace(/\n\n/g, '</p><p>')
    // Single newlines -> line breaks
    .replace(/\n/g, '<br>');

  html = '<p>' + html + '</p>';

  // Wrap protocol references as in-SPA links (Task 4.4 requirement)
  html = html.replace(/Protokoll\s+((\d+)(?:_([A-F]))?)/gi, (match, fullId, num, letter) => {
    const pid = letter ? `${num}_${letter}` : String(parseInt(num));
    return `<a href="/p/${pid}" onclick="event.preventDefault();window.ispApp.navigate('/p/${pid}')">Protokoll ${fullId}</a>`;
  });

  return html;
}

function linkifyRefs(html) {
  return html.replace(/Protokoll\s+((\d+)(?:_([A-F]))?)/gi, (match, fullId, num, letter) => {
    const pid = letter ? `${num}_${letter}` : String(parseInt(num));
    return `<a href="/p/${pid}" onclick="event.preventDefault();window.ispApp.navigate('/p/${pid}')">Protokoll ${fullId}</a>`;
  });
}

// Process a single line: extract icon placeholders, HTML-escape the rest, re-insert icon imgs,
// then linkify protocol references. This order is critical: icons must be extracted before esc()
// would mangle the [icon:...] brackets.
function processLine(raw) {
  const icons = [];
  // Strip any [note:...] that follows an [icon:unknown] (author annotation,
  // not meant for display).
  let src = raw.replace(/\[note:[^\]]*\]/g, '');
  // Extract [icon:KEY] placeholders before HTML escaping. Every icon renders
  // as its semantic text name via iconHtml() (the ICONS vocab); unknown keys
  // fall back to a generic label.
  const withMarkers = src.replace(/\[icon:([^\]]+)\]/g, (match, key) => {
    const idx = icons.length;
    icons.push(iconHtml(key));
    return `\x00ICON${idx}\x00`;
  });
  // Escape HTML entities
  let escaped = esc(withMarkers);
  // Re-insert icon HTML (the null-byte markers survive esc() since esc() doesn't touch them)
  escaped = escaped.replace(/\x00ICON(\d+)\x00/g, (m, idx) => icons[parseInt(idx, 10)]);
  // Linkify protocol references
  return linkifyRefs(escaped);
}

function formatInstructions(text) {
  if (!text) return '';

  // Split on double newlines to get paragraph blocks
  const blocks = text.split(/\n\n+/);
  const html = [];

  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(l => l);
    if (!lines.length) continue;

    const someBullets = lines.some(l => l.startsWith('• '));

    if (someBullets) {
      // A bullet's text can wrap over several lines in the source; only the
      // first line carries the "• " marker. Group each non-bullet line with the
      // PRECEDING bullet (it is a continuation) instead of hoisting it out.
      // Lines that appear before the first bullet are genuine intro text.
      const introLines = [];
      const items = [];          // array of arrays of lines (one per bullet)
      for (const line of lines) {
        if (line.startsWith('• ')) {
          items.push([line.replace(/^•\s*/, '')]);
        } else if (items.length) {
          items[items.length - 1].push(line);
        } else {
          introLines.push(line);
        }
      }
      if (introLines.length) {
        html.push(`<p>${introLines.map(l => processLine(l)).join('<br>')}</p>`);
      }
      const lis = items.map(group =>
        `<li>${group.map(l => processLine(l)).join(' ')}</li>`
      ).join('');
      html.push(`<ul>${lis}</ul>`);
    } else {
      // Regular paragraph
      const content = lines.map(l => processLine(l)).join('<br>');
      html.push(`<p>${content}</p>`);
    }
  }

  return html.join('');
}

// ---- Task 4.5: Audio player ----

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];
let playbackRate = parseFloat(localStorage.getItem('iss-vanguard-speed')) || 1;
if (!SPEEDS.includes(playbackRate)) playbackRate = 1;

function renderAudioPlayer(protocol) {
  const variantBtns = protocol.audioVariants && protocol.audioVariants.length > 0
    ? protocol.audioVariants.map(v =>
        `<button class="variant-btn" data-variant="${esc(v)}">${esc(v)}</button>`
      ).join('')
    : '';

  const speedBtns = SPEEDS.map(s =>
    `<button class="speed-btn${s === playbackRate ? ' active' : ''}" data-speed="${s}">${s}×</button>`
  ).join('');

  return `
    <div class="audio-section">
      <div class="variants" id="variant-btns">${variantBtns}</div>
      <audio id="audio-player" controls></audio>
      <div class="speed-control">
        <span class="speed-label">Geschwindigkeit</span>
        ${speedBtns}
      </div>
    </div>`;
}

function bindAudioPlayer(protocol) {
  const audioEl = document.getElementById('audio-player');
  if (!audioEl) return;

  function applyRate() {
    if (audioEl) audioEl.playbackRate = playbackRate;
  }
  audioEl.addEventListener('loadstart', applyRate);
  audioEl.addEventListener('loadedmetadata', applyRate);
  audioEl.addEventListener('play', applyRate);

  // Speed buttons
  document.querySelectorAll('.speed-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      playbackRate = parseFloat(btn.dataset.speed);
      localStorage.setItem('iss-vanguard-speed', String(playbackRate));
      document.querySelectorAll('.speed-btn').forEach(b =>
        b.classList.toggle('active', b === btn)
      );
      applyRate();
    });
  });

  // Variant buttons
  const variantBtns = document.querySelectorAll('.variant-btn');

  function playVariant(variant) {
    const num = String(protocol.number).padStart(4, '0');
    const fname = variant
      ? `protokoll_${num}_${variant}.ogg`
      : `protokoll_${num}.ogg`;
    audioEl.src = `/audiofiles/${fname}`;
    applyRate();
    audioEl.play().catch(() => {});
    variantBtns.forEach(b =>
      b.classList.toggle('active', b.dataset.variant === variant)
    );
  }

  variantBtns.forEach(btn => {
    btn.addEventListener('click', () => playVariant(btn.dataset.variant));
  });

  // Auto-play first variant (or base)
  if (protocol.audioVariants && protocol.audioVariants.length > 0) {
    playVariant(protocol.audioVariants[0]);
  } else {
    playVariant(null);
  }
}

// ---- Reference links (no checkbox) ----

// The "Lies Protokoll N" mentions printed in the instruction IMAGE aren't
// clickable (they're pixels). This panel lists those referenced protocols as
// plain links — no checkbox — for protocols that have no checklist.
function renderImageRefs(refs) {
  const links = refs.map(pid => {
    const pretty = String(pid).replace('_', ' ');
    return `<li><a href="/p/${esc(pid)}"
      onclick="event.preventDefault();window.ispApp.navigate('/p/${esc(pid)}')">Protokoll ${esc(pretty)}</a></li>`;
  }).join('');
  return `<div class="ref-links"><h3 class="checklist-title">Verweise</h3><ul class="ref-links-list">${links}</ul></div>`;
}

// ---- Task 4.6: Checklist ----

function renderChecklist(checklist, title) {
  const items = checklist.map(item => {
    const checked = state.checks[item.itemId] ? 'checked' : '';
    const disabled = state.activeSavegameId ? '' : 'disabled title="Savegame auswählen"';

    // Render the item as TEXT (not the printed strip image). processLine()
    // renders any [icon:KEY] game symbols as chips, HTML-escapes the rest, and
    // linkifies "Protokoll NN" mentions inline (covers "Lies Protokoll 37" and
    // multi-ref labels, and icons like "Erhalte 1 [icon:success]").
    //  - If the label has no inline "Protokoll NN" but the item has a reference
    //    (e.g. a P55 node "Versetzung der Stele"), wrap the whole label as a
    //    link to that protocol.
    let labelHtml;
    const labelTxt = (item.label || '').trim();
    const mentionsProto = /Protokoll\s+\d+/i.test(labelTxt);
    if (labelTxt && mentionsProto) {
      labelHtml = processLine(labelTxt);
    } else if (labelTxt && item.reference) {
      const pid = item.reference.targetId;
      labelHtml = `<a href="/p/${esc(pid)}" onclick="event.preventDefault();window.ispApp.navigate('/p/${esc(pid)}')">${processLine(labelTxt)}</a>`;
    } else if (labelTxt) {
      labelHtml = processLine(labelTxt);
    } else if (item.reference) {
      const pid = item.reference.targetId;
      labelHtml = `<a href="/p/${esc(pid)}" onclick="event.preventDefault();window.ispApp.navigate('/p/${esc(pid)}')">Lies Protokoll ${esc(String(pid).replace('_', ' '))}</a>`;
    } else {
      labelHtml = '';
    }

    // CSS.escape may not be available in all contexts; use a safe attribute value
    const safeItemId = item.itemId.replace(/"/g, '&quot;');
    const inputId = `chk-${item.itemId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    return `
      <div class="checklist-item" data-item-id="${safeItemId}">
        <input type="checkbox" id="${inputId}" ${checked} ${disabled}>
        <label for="${inputId}">${labelHtml}</label>
        <span class="save-error hidden"></span>
      </div>`;
  }).join('');

  const heading = state.activeSavegameId
    ? ''
    : '<p class="checklist-hint">Savegame auswählen, um Fortschritt zu speichern.</p>';
  const titleText = title || 'Fortschritt';
  return `<div class="checklist"><h3 class="checklist-title">${esc(titleText)}</h3>${heading}${items}</div>`;
}

function bindChecklist(checklist) {
  document.querySelectorAll('.checklist-item').forEach(row => {
    const itemId = row.dataset.itemId;
    const checkbox = row.querySelector('input[type="checkbox"]');
    const errorSpan = row.querySelector('.save-error');

    // Clicking a protocol link inside the label should navigate, NOT toggle the
    // checkbox (a <label for> would otherwise toggle its checkbox on any click).
    const label = row.querySelector('label');
    if (label) {
      label.addEventListener('click', (e) => {
        if (e.target.closest('a')) e.preventDefault();
      });
    }

    checkbox.addEventListener('change', async () => {
      if (!state.activeSavegameId) return;

      const newVal = checkbox.checked;
      // Optimistic update
      if (newVal) state.checks[itemId] = true;
      else delete state.checks[itemId];

      hide(errorSpan);

      try {
        const resp = await api(
          'PUT',
          `/api/savegames/${state.activeSavegameId}/checks/${encodeURIComponent(itemId)}`,
          { checked: newVal }
        );
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        // Confirm server state
        checkbox.checked = data.checked;
        if (data.checked) state.checks[itemId] = true;
        else delete state.checks[itemId];
        // Keep a diagram overlay marker (e.g. P55) in sync if one is on-page.
        syncOverlayMarker(itemId, data.checked);
      } catch (err) {
        // Revert on error
        checkbox.checked = !newVal;
        if (!newVal) state.checks[itemId] = true;
        else delete state.checks[itemId];
        errorSpan.textContent = '✕ Nicht gespeichert';
        show(errorSpan);
        setTimeout(() => hide(errorSpan), 3000);
      }
    });
  });
}

// ============================================================
// Task 4.7 — Fortschritt (progress) page
// ============================================================

// Compact label for the Fortschritt grid. Short labels (letters, "Kästchen N",
// "Lies Protokoll N", short gains) are kept verbatim. Long instruction
// sentences are collapsed: to their "Lies Protokoll N" reference if they have
// one, otherwise truncated with an ellipsis (full text stays in the title).
const FP_LABEL_MAX = 42;
// Replace [icon:KEY] markers with their readable bracketed name, e.g.
// "[icon:success]" -> "[Erfolgs-Marker]". Used for the plain-text Fortschritt
// labels (which don't go through the icon-rendering pipeline).
function expandIconNames(text) {
  return text.replace(/\[icon:([^\]]+)\]/g, (_m, key) => {
    const def = ICONS[key] || ICONS.unknown;
    return `[${def.label}]`;
  });
}
function fortschrittShortLabel(it) {
  const full = expandIconNames((it.label || '').trim());
  if (!full) return '';
  if (full.length <= FP_LABEL_MAX) return full;
  const ref = it.reference && it.reference.targetId;
  if (ref) {
    const pretty = String(ref).replace('_', ' ');
    return `Lies Protokoll ${pretty}`;
  }
  return full.slice(0, FP_LABEL_MAX - 1).trimEnd() + '…';
}

async function renderFortschritt() {
  history.replaceState(null, '', '/fortschritt');

  if (!state.activeSavegameId) {
    $mainContent.innerHTML = '<p class="progress-prompt">Wähle ein Savegame aus, um den Fortschritt zu sehen.</p>';
    return;
  }

  const resp = await api('GET', `/api/savegames/${state.activeSavegameId}/progress`);
  if (!resp.ok) {
    $mainContent.innerHTML = '<p class="error">Fortschritt konnte nicht geladen werden.</p>';
    return;
  }

  const progress = await resp.json();   // [{id, number, title, items:[{itemId,label,checked}]}]

  if (progress.length === 0) {
    $mainContent.innerHTML = '<p class="progress-prompt">Keine Protokolle mit Fortschritt vorhanden.</p>';
    return;
  }

  // One block per protocol: the protocol number links to the protocol; each
  // checkbox is the SAME check item as in the protocol view (shared state via
  // the /checks API). Short item labels (A/B/C, "Lies Protokoll XXX", …) are
  // kept. Blocks fill left-to-right then wrap (CSS grid, reading order).
  const blocks = progress.map(p => {
    const rows = p.items.map(it => {
      const safeId = it.itemId.replace(/"/g, '&quot;');
      const inputId = `fp-${it.itemId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
      const checked = it.checked ? 'checked' : '';
      const full = it.label && it.label.trim() ? expandIconNames(it.label.trim()) : '';
      const shortTxt = fortschrittShortLabel(it);
      const labelHtml = shortTxt
        ? `<label for="${inputId}" class="fp-box-label" title="${esc(full)}">${esc(shortTxt)}</label>`
        : `<label for="${inputId}" class="fp-box-label fp-box-label--empty"></label>`;
      return `
        <div class="fp-box" data-item-id="${safeId}">
          <input type="checkbox" id="${inputId}" ${checked}>
          ${labelHtml}
          <span class="save-error hidden"></span>
        </div>`;
    }).join('');
    return `
      <div class="fp-log">
        <a class="fp-log-title" href="/p/${esc(p.id)}"
           onclick="event.preventDefault();window.ispApp.navigate('/p/${esc(p.id)}')">Protokoll ${esc(String(p.number))}</a>
        <div class="fp-boxes">${rows}</div>
      </div>`;
  }).join('');

  $mainContent.innerHTML = `<div class="fp-grid">${blocks}</div>`;

  bindFortschrittBoxes();
}

function bindFortschrittBoxes() {
  document.querySelectorAll('.fp-box').forEach(row => {
    const itemId = row.dataset.itemId;
    const checkbox = row.querySelector('input[type="checkbox"]');
    const errorSpan = row.querySelector('.save-error');
    checkbox.addEventListener('change', async () => {
      if (!state.activeSavegameId) return;
      const newVal = checkbox.checked;
      if (newVal) state.checks[itemId] = true; else delete state.checks[itemId];
      hide(errorSpan);
      try {
        const resp = await api(
          'PUT',
          `/api/savegames/${state.activeSavegameId}/checks/${encodeURIComponent(itemId)}`,
          { checked: newVal }
        );
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        checkbox.checked = data.checked;
        if (data.checked) state.checks[itemId] = true; else delete state.checks[itemId];
      } catch (_err) {
        checkbox.checked = !newVal;
        if (!newVal) state.checks[itemId] = true; else delete state.checks[itemId];
        errorSpan.textContent = '✕ Nicht gespeichert';
        show(errorSpan);
        setTimeout(() => hide(errorSpan), 3000);
      }
    });
  });
}

// ============================================================
// Planeten (planetary record sheets) — one sheet per planet,
// fields stored per savegame in the DB (same /notes API).
// ============================================================

let _planetsCache = null;      // {slug,name}[]
let _sheetFieldsCache = null;  // {pages:[{image,vbW,vbH,fields:[...]}]}

async function loadPlanets() {
  if (_planetsCache) return _planetsCache;
  const r = await fetch('/static/forms/planets.json');
  const data = await r.json();
  _planetsCache = (data.planets || []).filter(p => !String(p.slug).startsWith('_'));
  return _planetsCache;
}
async function loadSheetFields() {
  if (_sheetFieldsCache) return _sheetFieldsCache;
  const r = await fetch('/static/forms/planet_sheet.fields.json');
  _sheetFieldsCache = await r.json();
  return _sheetFieldsCache;
}
function planetFieldNoteId(slug, fieldName) {
  return `planet-${slug}-${fieldName}`;
}

async function renderPlanetIndex() {
  history.replaceState(null, '', '/planeten');
  const planets = await loadPlanets();
  const cards = planets.map(p => `
    <a class="planet-card" href="/planet/${esc(p.slug)}"
       onclick="event.preventDefault();window.ispApp.navigate('/planet/${esc(p.slug)}')">
      ${esc(p.name)}
    </a>`).join('');
  $mainContent.innerHTML = `
    <div class="planet-head">
      <h2 class="protocol-title">Planeten-Datenblätter</h2>
      <a class="planet-back" href="/p/999"
         onclick="event.preventDefault();window.ispApp.navigate('/p/999')">↩ Zur Sternenkarte (P999)</a>
    </div>
    <div class="planet-grid">${cards}</div>`;
}

async function renderPlanetSheet(slug) {
  history.replaceState(null, '', `/planet/${encodeURIComponent(slug)}`);
  const [planets, sheet] = await Promise.all([loadPlanets(), loadSheetFields()]);
  const planet = planets.find(p => p.slug === slug);
  if (!planet) {
    $mainContent.innerHTML = '<p class="error">Planet nicht gefunden.</p>';
    return;
  }

  // Load this savegame's notes so field values are populated.
  if (state.activeSavegameId) {
    const nr = await api('GET', `/api/savegames/${state.activeSavegameId}/notes`);
    if (nr.ok) state.notes = await nr.json();
  }

  const disabled = state.activeSavegameId ? '' : 'disabled';
  const hint = state.activeSavegameId
    ? ''
    : '<p class="checklist-hint">Savegame auswählen, um Eingaben zu speichern.</p>';

  // Overlay the fields as absolutely-positioned HTML textareas using PERCENT
  // coordinates (of the page's point-size). Percent positioning scales cleanly
  // with the image at any width, so text stays centred in every box regardless
  // of how far down the page it is (the old SVG/foreignObject stretch drifted).
  const pagesHtml = sheet.pages.map(pg => {
    const fields = pg.fields.map(f => {
      const id = planetFieldNoteId(slug, f.name);
      let val = state.notes[id];
      if (val == null && /planet\s*name/i.test(f.name)) val = planet.name;
      val = val || '';
      const left = (f.x / pg.vbW) * 100;
      const top = (f.y / pg.vbH) * 100;
      const w = (f.w / pg.vbW) * 100;
      const h = (f.h / pg.vbH) * 100;
      const style = `left:${left.toFixed(3)}%;top:${top.toFixed(3)}%;`
        + `width:${w.toFixed(3)}%;height:${h.toFixed(3)}%;`;
      if (f.multiline) {
        return `<textarea class="sheet-field sheet-field--multi" style="${style}"
          data-note-id="${esc(id)}" title="${esc(f.name)}" ${disabled}>${esc(val)}</textarea>`;
      }
      // Single-line: a text <input> natively vertical-centres its text. With
      // percent positioning (no SVG stretch) this centres uniformly everywhere.
      return `<input type="text" class="sheet-field sheet-field--line" style="${style}"
        data-note-id="${esc(id)}" title="${esc(f.name)}" value="${esc(val)}" ${disabled}>`;
    }).join('');
    return `
      <div class="sheet-canvas" style="aspect-ratio:${pg.vbW} / ${pg.vbH};">
        <img class="sheet-img" src="/static/forms/${esc(pg.image)}" alt="Datenblatt" loading="lazy">
        ${fields}
      </div>`;
  }).join('');

  $mainContent.innerHTML = `
    <div class="planet-head">
      <h2 class="protocol-title">${esc(planet.name)} — Datenblatt</h2>
      <a class="planet-back" href="/p/999"
         onclick="event.preventDefault();window.ispApp.navigate('/p/999')">↩ Zur Sternenkarte (P999)</a>
    </div>
    ${hint}
    <div class="planet-sheet">${pagesHtml}</div>`;

  bindSheetFields();
}

function bindSheetFields() {
  document.querySelectorAll('.sheet-field[data-note-id]').forEach(el => {
    const isDiv = el.tagName === 'DIV';           // contenteditable single-line
    const getText = () => (isDiv ? el.textContent : el.value);
    let timer = null;
    const save = async () => {
      if (!state.activeSavegameId) return;
      const id = el.dataset.noteId;
      const text = getText();
      state.notes[id] = text;
      el.classList.toggle('has-text', !!text.trim());
      try {
        const r = await api(
          'PUT',
          `/api/savegames/${state.activeSavegameId}/notes/${encodeURIComponent(id)}`,
          { text }
        );
        if (!r.ok) throw new Error('save failed');
        el.classList.remove('save-failed');
      } catch (_e) {
        el.classList.add('save-failed');
      }
    };
    el.classList.toggle('has-text', !!getText().trim());
    el.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(save, 600); });
    el.addEventListener('blur', () => { clearTimeout(timer); save(); });
    if (isDiv) {
      // keep single-line: Enter blurs instead of inserting a newline
      el.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } });
    }
  });
}

// ============================================================
// Dokumente (PDF links) page
// ============================================================

const DOCUMENTS = [
  {
    title: 'Regel-Zusammenfassung (v2.5)',
    desc: 'Kompakte Übersicht der Regeln.',
    url: '/static/docs/rules_summary_v2.5.pdf',
  },
  {
    title: 'Quick Reference (EN)',
    desc: 'Kurzreferenz der Regeln (englisch).',
    url: '/static/docs/rules_complete_v2.pdf',
  },
  {
    title: 'Regelbuch (DE, 48 Seiten)',
    desc: 'Das offizielle deutsche Regelbuch (hochauflösend).',
    url: '/static/docs/rulebook_de.pdf',
  },
  {
    title: 'Logbuch (offline, DE)',
    desc: 'Das deutsche Offline-Logbuch als PDF.',
    url: '/static/docs/logbuch_offline_de.pdf',
  },
  {
    title: 'Spickzettel (online)',
    desc: 'Interaktiver ISS-Vanguard-Spickzettel (externe Website).',
    url: 'https://iss-vanguard-spickzettel.netlify.app/',
    kind: 'web',
  },
];

function renderDokumente() {
  history.replaceState(null, '', '/dokumente');
  const items = DOCUMENTS.map(d => `
    <a class="doc-card" href="${esc(d.url)}" target="_blank" rel="noopener">
      <span class="doc-icon${d.kind === 'web' ? ' doc-icon--web' : ''}" aria-hidden="true">${d.kind === 'web' ? 'WEB' : 'PDF'}</span>
      <span class="doc-meta">
        <span class="doc-title">${esc(d.title)}</span>
        <span class="doc-desc">${esc(d.desc)}</span>
      </span>
    </a>`).join('');
  $mainContent.innerHTML = `
    <h2 class="protocol-title">Dokumente</h2>
    <div class="doc-list">${items}</div>`;
}

// ============================================================
// Einstellungen (settings) page
// ============================================================

function renderSettings() {
  history.replaceState(null, '', '/einstellungen');
  const vm = settings.viewMode || 'auto';
  const opt = (val, label) =>
    `<button class="viewmode-btn${vm === val ? ' active' : ''}" data-view="${val}">${label}</button>`;
  $mainContent.innerHTML = `
    <h2 class="protocol-title">Einstellungen</h2>
    <div class="settings-list">
      <label class="setting-row">
        <span class="setting-label">
          Textteil anzeigen
          <small>Zeigt den Erzähltext zusätzlich zum Anweisungs-Screenshot. Der
          Audio-Player und der Screenshot werden immer angezeigt.</small>
        </span>
        <input type="checkbox" id="setting-show-text" ${settings.showText ? 'checked' : ''}>
      </label>
      <div class="setting-row">
        <span class="setting-label">
          Ansicht
          <small>Darstellung für Handy oder Desktop/Tablet. „Automatisch“ wählt
          anhand der Bildschirmbreite. Ändere auf „Mobil“, wenn es auf dem
          iPhone zu eng ist.</small>
        </span>
        <span class="viewmode-group">
          ${opt('auto', 'Automatisch')}${opt('mobile', 'Mobil')}${opt('desktop', 'Desktop')}
        </span>
      </div>
    </div>`;

  const cb = document.getElementById('setting-show-text');
  cb.addEventListener('change', () => {
    settings.showText = cb.checked;
    saveSettings(settings);
    // If a protocol is currently loaded, re-render it live so the change is
    // visible immediately when the user navigates back.
  });

  document.querySelectorAll('.viewmode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      settings.viewMode = btn.dataset.view;
      saveSettings(settings);
      applyViewMode();
      document.querySelectorAll('.viewmode-btn').forEach(b =>
        b.classList.toggle('active', b === btn));
    });
  });
}

// ============================================================
// Savegame management
// ============================================================

function openCreateSavegameDialog() {
  $newSavegameName.value = '';
  hide($createSavegameError);
  show($createSavegameDialog);
  $newSavegameName.focus();
}

function closeCreateSavegameDialog() {
  hide($createSavegameDialog);
}

async function createSavegame(name) {
  const resp = await api('POST', '/api/savegames', { name });
  if (resp.status === 409) {
    $createSavegameError.textContent = 'Dieser Name ist bereits vergeben.';
    show($createSavegameError);
    return false;
  }
  if (!resp.ok) {
    $createSavegameError.textContent = 'Fehler beim Erstellen.';
    show($createSavegameError);
    return false;
  }
  const sg = await resp.json();
  // Select the newly created savegame
  await selectSavegame(sg.id);
  await refreshUserAndSavegames();
  closeCreateSavegameDialog();
  return true;
}

async function selectSavegame(id) {
  const resp = await api('POST', `/api/savegames/${id}/select`);
  if (resp.ok) {
    const data = await resp.json();
    state.activeSavegameId = data.activeSavegameId;
    renderSavegameBar();
    // Refresh current protocol's checklist state if one is loaded
    if (state.currentProtocolId) loadProtocol(state.currentProtocolId);
  }
}

async function deleteActiveSavegame() {
  if (!state.activeSavegameId) return;
  const sg = state.user && state.user.savegames
    ? state.user.savegames.find(s => s.id === state.activeSavegameId)
    : null;
  const name = sg ? sg.name : state.activeSavegameId;
  if (!confirm(`Savegame "${name}" wirklich löschen? Alle Daten gehen verloren.`)) return;

  const resp = await api('DELETE', `/api/savegames/${state.activeSavegameId}`);
  if (!resp.ok) { alert('Fehler beim Löschen.'); return; }
  state.activeSavegameId = null;
  await refreshUserAndSavegames();
  // Re-render current protocol with disabled checkboxes
  if (state.currentProtocolId) loadProtocol(state.currentProtocolId);
}

// ============================================================
// Event wiring
// ============================================================

function wireDOMEvents() {
  // Login form
  $loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const ok = await doLogin(username, password);
    if (!ok) {
      show($loginError);
    } else {
      hide($loginError);
      const user = await checkAuth();
      if (user) await onAuthenticated(user);
    }
  });

  // Logout
  $logoutBtn.addEventListener('click', doLogout);

  // Jump box
  $jumpBtn.addEventListener('click', doJump);
  $jumpInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') doJump(); });

  // Prev / next protocol arrows
  if ($prevBtn) $prevBtn.addEventListener('click', () => navigateRelative(-1));
  if ($nextBtn) $nextBtn.addEventListener('click', () => navigateRelative(1));

  function doJump() {
    const id = parseProtocolId($jumpInput.value);
    hide($jumpError);
    if (!id) { show($jumpError); return; }
    if (!state.contentIndex) return;
    const exists = state.contentIndex.some(p => p.id === id);
    if (!exists) { show($jumpError); return; }
    navigate(`/p/${id}`);
  }

  // Fortschritt nav link
  $navFortschritt.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/fortschritt');
  });

  // Einstellungen nav link
  if ($navEinstellungen) {
    $navEinstellungen.addEventListener('click', (e) => {
      e.preventDefault();
      navigate('/einstellungen');
    });
  }

  // Dokumente nav link
  if ($navDokumente) {
    $navDokumente.addEventListener('click', (e) => {
      e.preventDefault();
      navigate('/dokumente');
    });
  }

  // Planeten nav link
  if ($navPlaneten) {
    $navPlaneten.addEventListener('click', (e) => {
      e.preventDefault();
      navigate('/planeten');
    });
  }

  // Burger menu (mobile): toggle the nav open/closed.
  if ($navBurger && $headerNav) {
    const closeNav = () => {
      $headerNav.classList.remove('open');
      $navBurger.classList.remove('open');
      $navBurger.setAttribute('aria-expanded', 'false');
    };
    const toggleNav = () => {
      const open = !$headerNav.classList.contains('open');
      $headerNav.classList.toggle('open', open);
      $navBurger.classList.toggle('open', open);
      $navBurger.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    $navBurger.addEventListener('click', (e) => { e.stopPropagation(); toggleNav(); });
    // Tapping any nav item (link, username area, logout) closes the menu.
    $headerNav.addEventListener('click', (e) => {
      if (e.target.closest('a, button')) closeNav();
    });
    // Tapping outside the open menu closes it.
    document.addEventListener('click', (e) => {
      if (!$headerNav.classList.contains('open')) return;
      if (e.target.closest('#header-nav') || e.target.closest('#nav-burger')) return;
      closeNav();
    });
    // Expose for navigate() to auto-close on any route change.
    window._issCloseNav = closeNav;
  }

  // Savegame select dropdown
  $savegameSelect.addEventListener('change', () => {
    const id = parseInt($savegameSelect.value, 10);
    selectSavegame(id);
  });

  // New savegame buttons
  $newSavegameBtn.addEventListener('click', openCreateSavegameDialog);
  $createFirstSavegameBtn.addEventListener('click', openCreateSavegameDialog);

  // Delete savegame
  $deleteSavegameBtn.addEventListener('click', deleteActiveSavegame);

  // Create savegame dialog
  $createSavegameConfirm.addEventListener('click', async () => {
    const name = $newSavegameName.value.trim();
    if (!name) {
      $createSavegameError.textContent = 'Bitte einen Namen eingeben.';
      show($createSavegameError);
      return;
    }
    await createSavegame(name);
  });
  $createSavegameCancel.addEventListener('click', closeCreateSavegameDialog);
  $newSavegameName.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
      const name = $newSavegameName.value.trim();
      if (name) await createSavegame(name);
    }
  });

  // Close dialog on overlay click
  $createSavegameDialog.addEventListener('click', (e) => {
    if (e.target === $createSavegameDialog) closeCreateSavegameDialog();
  });
}

// ============================================================
// BroadcastChannel (Task 4.3 — cross-tab reuse, legacy /play/ URLs)
// ============================================================

function setupBroadcastChannel() {
  channel.addEventListener('message', (event) => {
    const data = event.data || {};
    if (data.action === 'ping' && isPlayerTab) {
      channel.postMessage({ action: 'pong' });
    } else if (data.action === 'play' && isPlayerTab) {
      const id = parseProtocolId(data.protokoll);
      if (id) navigate(`/p/${id}`);
      window.focus();
    }
  });

  const path = window.location.pathname;
  const match = path.match(/^\/play\/(.+)/);

  if (match) {
    const protokollId = match[1];
    let otherTabExists = false;
    const pongListener = (event) => {
      if (event.data && event.data.action === 'pong') otherTabExists = true;
    };
    channel.addEventListener('message', pongListener);
    channel.postMessage({ action: 'ping' });

    // Give existing tabs 250 ms to respond
    setTimeout(() => {
      channel.removeEventListener('message', pongListener);
      if (otherTabExists) {
        // Hand off to the existing player tab
        channel.postMessage({ action: 'play', protokoll: protokollId });
        if (window.history.length > 1) {
          window.history.back();
        } else {
          document.body.innerHTML = '<div style="text-align:center;padding:3rem;color:#4fc3f7;font-size:1.2rem;">Audio wird im anderen Tab abgespielt.<br><br><small>Dieser Tab kann geschlossen werden.</small></div>';
        }
      } else {
        // No existing player tab — this tab becomes the player
        isPlayerTab = true;
        bootstrap();
      }
    }, 250);
  } else {
    isPlayerTab = true;
    bootstrap();
  }
}

// ============================================================
// Init
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  $loginScreen            = document.getElementById('login-screen');
  $appShell               = document.getElementById('app-shell');
  $loginForm              = document.getElementById('login-form');
  $loginError             = document.getElementById('login-error');
  $headerUsername         = document.getElementById('header-username');
  $logoutBtn              = document.getElementById('logout-btn');
  $navFortschritt         = document.getElementById('nav-fortschritt');
  $navEinstellungen       = document.getElementById('nav-einstellungen');
  $navDokumente           = document.getElementById('nav-dokumente');
  $navPlaneten            = document.getElementById('nav-planeten');
  $navBurger              = document.getElementById('nav-burger');
  $headerNav              = document.getElementById('header-nav');
  $savegameBar            = document.getElementById('savegame-bar');
  $savegameSelect         = document.getElementById('savegame-select');
  $newSavegameBtn         = document.getElementById('new-savegame-btn');
  $deleteSavegameBtn      = document.getElementById('delete-savegame-btn');
  $noSavegameInfo         = document.getElementById('no-savegame-info');
  $createFirstSavegameBtn = document.getElementById('create-first-savegame-btn');
  $jumpInput              = document.getElementById('jump-input');
  $jumpBtn                = document.getElementById('jump-btn');
  $jumpError              = document.getElementById('jump-error');
  $prevBtn                = document.getElementById('prev-btn');
  $nextBtn                = document.getElementById('next-btn');
  $mainContent            = document.getElementById('main-content');
  $createSavegameDialog   = document.getElementById('create-savegame-dialog');
  $newSavegameName        = document.getElementById('new-savegame-name');
  $createSavegameConfirm  = document.getElementById('create-savegame-confirm');
  $createSavegameCancel   = document.getElementById('create-savegame-cancel');
  $createSavegameError    = document.getElementById('create-savegame-error');

  // Expose navigate globally for inline onclick handlers in rendered HTML
  window.ispApp = { navigate };

  applyViewMode();
  wireDOMEvents();
  setupBroadcastChannel();
});
