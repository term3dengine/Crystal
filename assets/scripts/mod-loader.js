(function() {
  'use strict';

  const MOD_BRIDGE_KEY = '_mod_bridge';
  const MODS_DIR = '/mods/';

  class ModLoader {
    constructor() {
      this.pyodide = null;
      this.mods = [];
      this.activeScene = null;
      this.sceneStarted = new Set();
      this.ready = false;
      this._gameScene = null;
      this._lastCollisionType = 0;
      this._overlay = null;
      this._tipText = null;
      this._keyState = {};
      this._prevKeyState = {};
      this._mouseDown = false;
      this._prevMouseDown = false;
      this._pointerDownThisFrame = false;
      this._modTexts = new Map();
      this._nextTextId = 1;
      this._prevSlideIn = false;
      this._uiContainers = new Map();
      this._nextUiId = 1;
      this._uiCallbacks = new Map();
      this._nextCallbackId = 1;
      this._modFileInput = null;
      this._onModUploaded = null;
      this._htmlContainers = new Map();
      this._nextHtmlId = 1;
      this._tabDown = false;
      this._prevTabDown = false;
      this._globalKeyState = {};
    }

    async init() {
      this._showOverlay('Initializing...');
      this._injectHtmlStyles();
      this._setupTabTracking();
      this._setupFileUpload();
      try {
        await this._loadPyodide();
        this.pyodide.runPython(`
import sys
sys.path.insert(0, '/mods')
`);

        window[MOD_BRIDGE_KEY] = {
          call: (method, ...args) => this.jsCall(method, ...args),
          log: (msg) => console.log('[Mod]', msg)
        };

        await this._loadCrystalModule();
        await this._discoverAndLoadMods();
        const savedMods = this._storageListMods();
        for (const modName of savedMods) {
          const code = this._storageLoadMod(modName);
          if (code) {
            this._updateOverlay('Loading saved mod: ' + modName);
            await this._executeModCode(modName, code);
          }
        }
        this._hookGameLoop();
        this.ready = true;
        setTimeout(() => {
          this._hideOverlay();
        }, 600);
        console.log('[ModLoader] Ready with', this.mods.length, 'mod(s)');
      } catch (err) {
        console.error('[ModLoader] Failed to initialize:', err);
        this._updateOverlay('Mod loader failed: ' + err.message);
      }
    }

    _showOverlay(message) {
      if (!this._overlay) {
        this._overlay = document.createElement('div');
        this._overlay.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.75);color:#ffcc00;font-family:"Segoe UI",Tahoma,Geneva,Verdana,sans-serif;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:bold;z-index:99999;pointer-events:none;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,0.5);text-shadow:0 1px 2px rgba(0,0,0,0.9);';
        this._tipText = this._overlay;
        document.body.appendChild(this._overlay);
      }
      this._overlay.style.display = 'block';
      if (message !== undefined) {
        this._tipText.textContent = message || '';
      }
    }

    _updateOverlay(message) {
      if (this._tipText) this._tipText.textContent = message || '';
      console.log('[ModLoader]', message || '');
    }

    _hideOverlay() {
      if (this._overlay) {
        this._overlay.style.display = 'none';
      }
    }

    _injectHtmlStyles() {
      if (document.getElementById('crystal-html-panel-styles')) return;
      const style = document.createElement('style');
      style.id = 'crystal-html-panel-styles';
      style.textContent = `
        .crystal-html-panel {
          position: fixed;
          background: rgba(0, 0, 0, 0.85);
          border: 2px solid #ffcc00;
          border-radius: 8px;
          padding: 16px;
          color: #ffcc00;
          font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
          z-index: 99998;
          pointer-events: auto;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
          min-width: 200px;
        }
        .crystal-html-panel h3 {
          margin: 0 0 12px 0;
          font-size: 18px;
          color: #ffcc00;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9);
        }
        .crystal-html-button {
          display: block;
          width: 100%;
          padding: 8px 12px;
          margin: 6px 0;
          background: rgba(255, 204, 0, 0.15);
          border: 1px solid #ffcc00;
          border-radius: 4px;
          color: #ffcc00;
          font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
          font-size: 14px;
          cursor: pointer;
          transition: background 0.15s;
        }
        .crystal-html-button:hover {
          background: rgba(255, 204, 0, 0.3);
        }
        .crystal-html-label {
          display: block;
          margin: 8px 0;
          font-size: 14px;
          color: #ffcc00;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9);
        }
        .crystal-html-input {
          width: 100%;
          padding: 8px;
          margin: 6px 0;
          background: rgba(0, 0, 0, 0.5);
          border: 1px solid #ffcc00;
          border-radius: 4px;
          color: #ffcc00;
          font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
          font-size: 14px;
          outline: none;
        }
        .crystal-html-input::placeholder {
          color: rgba(255, 204, 0, 0.5);
        }
      `;
      document.head.appendChild(style);
    }

    _setupTabTracking() {
      window.addEventListener('keydown', (e) => {
        this._globalKeyState[e.key.toLowerCase()] = true;
        this._globalKeyState[e.code.toLowerCase()] = true;
        this._globalKeyState[String(e.keyCode).toLowerCase()] = true;
        if (e.key === 'Tab') {
          this._tabDown = true;
        }
      });
      window.addEventListener('keyup', (e) => {
        this._globalKeyState[e.key.toLowerCase()] = false;
        this._globalKeyState[e.code.toLowerCase()] = false;
        this._globalKeyState[String(e.keyCode).toLowerCase()] = false;
        if (e.key === 'Tab') {
          this._tabDown = false;
        }
      });
    }

    async _loadPyodide() {
      if (typeof loadPyodide === 'function') {
        this.pyodide = await loadPyodide({
          indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/'
        });
        return;
      }
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js';
        script.onload = resolve;
        script.onerror = () => reject(new Error('Failed to load Pyodide'));
        document.head.appendChild(script);
      });
      if (typeof loadPyodide !== 'function') {
        throw new Error('loadPyodide not available after script load');
      }
      this.pyodide = await loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/'
      });
    }

    async _loadCrystalModule() {
      try {
        const res = await fetch('/mods/crystal.py');
        if (!res.ok) throw new Error('crystal.py not found');
        const code = await res.text();
        this.pyodide.runPython(code);
        this.pyodide.runPython(`
import sys, types
if 'crystal' not in sys.modules:
    _m = types.ModuleType('crystal')
    _g = globals()
    for _n in ['Crystal', 'PlayerProxy', 'GameProxy', 'InputProxy', 'JSProxy', 'LoadingProxy', 'TextProxy', 'UIProxy', 'StorageProxy', 'HTMLProxy', '_get_ui_callback', '_get_html_callback']:
        if _n in _g:
            setattr(_m, _n, _g[_n])
    sys.modules['crystal'] = _m
`);
      } catch (e) {
        console.error('[ModLoader] Failed to load crystal module:', e);
        throw e;
      }
    }

    async _discoverAndLoadMods() {
      const discovered = await this._listModFiles();
      for (let i = 0; i < discovered.length; i++) {
        const modFile = discovered[i];
        this._updateOverlay('Loading mod: ' + modFile + ' (' + (i + 1) + '/' + discovered.length + ')');
        await this._loadModFile(modFile);
      }
    }

    _normalizeModPath(href) {
      if (!href) return null;
      const cleaned = href.replace(/^[\/\\]+/, '').replace(/^mods[\/\\]/, '').replace(/\\/g, '/');
      if (cleaned.includes('/')) return null;
      return cleaned;
    }

    async _loadModMetadata() {
      try {
        const res = await fetch('/mods/mods.json');
        if (!res.ok) return null;
        const manifest = await res.json();
        const mods = manifest.mods || manifest.entries || [];
        const metaMap = new Map();
        for (const m of mods) {
          const file = String(m.file || m).replace(/^[\/\\]+/, '').replace(/^mods[\/\\]/, '').replace(/\\/g, '/');
          if (!file.endsWith('.py') || file === 'crystal.py' || file.includes('/')) continue;
          metaMap.set(file, {
            file: file,
            name: String(m.name || file),
            author: String(m.author || 'Unknown'),
            description: String(m.description || ''),
            version: String(m.version || '1.0.0'),
            priority: Number(m.priority) || 0,
            load_after: Array.isArray(m.load_after) ? m.load_after.map(String) : []
          });
        }
        return metaMap;
      } catch (e) {
        console.warn('[ModLoader] Failed to load mod metadata:', e);
        return null;
      }
    }

    _sortModFiles(files, metadata) {
      if (!metadata || metadata.size === 0) {
        return files.sort();
      }
      const fileToMeta = new Map();
      for (const [file, meta] of metadata) {
        fileToMeta.set(file, meta);
      }
      const sorted = files.slice().sort((a, b) => {
        const metaA = fileToMeta.get(a);
        const metaB = fileToMeta.get(b);
        const priorityA = metaA ? metaA.priority : 0;
        const priorityB = metaB ? metaB.priority : 0;
        if (priorityB !== priorityA) return priorityB - priorityA;
        return a.localeCompare(b);
      });
      const result = [];
      const added = new Set();
      const addFile = (file) => {
        if (added.has(file)) return;
        const meta = fileToMeta.get(file);
        if (meta && meta.load_after) {
          for (const dep of meta.load_after) {
            addFile(dep);
          }
        }
        if (!added.has(file)) {
          result.push(file);
          added.add(file);
        }
      };
      for (const file of sorted) {
        addFile(file);
      }
      return result;
    }

    async _listModFiles() {
      const files = [];
      try {
        const res = await fetch(MODS_DIR);
        if (!res.ok) throw new Error('Cannot list mods dir');
        const text = await res.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
        const links = doc.querySelectorAll('a');
        links.forEach(link => {
          const raw = link.getAttribute('href') || '';
          const normalized = this._normalizeModPath(raw);
          if (normalized && normalized !== 'crystal.py') {
            files.push(normalized);
          }
        });
      } catch (e) {
        console.warn('[ModLoader] Directory listing unavailable, trying known mods...');
      }
      if (files.length === 0) {
        try {
          const res = await fetch('/mods/mods.json');
          if (res.ok) {
            const manifest = await res.json();
            const rawMods = manifest.mods || manifest.entries || [];
            for (const m of rawMods) {
              const name = typeof m === 'string' ? m : (m.file || m.name || '');
              const cleaned = String(name).replace(/^[\/\\]+/, '').replace(/^mods[\/\\]/, '').replace(/\\/g, '/');
              if (cleaned.endsWith('.py') && cleaned !== 'crystal.py' && !cleaned.includes('/')) {
                files.push(cleaned);
              }
            }
          }
        } catch (e) {}
      }
      const metadata = await this._loadModMetadata();
      return this._sortModFiles(files, metadata);
    }

    async _loadModFile(filename) {
      try {
        const cleanName = String(filename).replace(/^[\/\\]+/, '').replace(/^mods[\/\\]/, '').replace(/\\/g, '/');
        if (!cleanName || cleanName === 'crystal.py') return;
        const url = '/mods/' + cleanName;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch ' + cleanName + ' (' + res.status + ')');
        const code = await res.text();
        this.pyodide.runPython(code);

        this.pyodide.runPython(`
if 'mod' in dir():
    _mod_loader_mod_obj = mod
else:
    _mod_loader_mod_obj = None
`);
        const modObj = this.pyodide.globals.get('_mod_loader_mod_obj');
        if (!modObj) {
          console.warn('[ModLoader] No mod object found in', cleanName);
          return;
        }

        modObj._set_bridge({
          call: (method, ...args) => this.jsCall(method, ...args),
          log: (msg) => console.log('[Mod]', msg)
        });

        this.mods.push({
          name: cleanName,
          startHandlers: modObj._start_handlers,
          updateHandlers: modObj._update_handlers
        });
        
        const metadata = await this._loadModMetadata();
        if (metadata && metadata.has(cleanName)) {
          const meta = metadata.get(cleanName);
          console.log('[ModLoader] Registered mod:', cleanName, '-', meta.name || cleanName, 'by', meta.author || 'Unknown', '- total:', this.mods.length);
        } else {
          console.log('[ModLoader] Registered mod:', cleanName, '- total:', this.mods.length);
        }
      } catch (e) {
        console.error('[ModLoader] Failed to load mod', filename, ':', e);
      }
    }

    _hookGameLoop() {
      const self = this;
      const origUpdate = GameScene.prototype.update;
      GameScene.prototype.update = function(time, deltaTime) {
        origUpdate.call(this, time, deltaTime);
        if (!self.ready) return;
        self._gameScene = this;
        self._updateInputTracking(this);
        self._updateCollisionTracking(this);
        const scene = self._detectScene(this);
        if (scene !== self.activeScene) {
          const prev = self.activeScene;
          self.activeScene = scene;
          self._fireOnStart(prev, scene);
        }
        self._fireUpdate(scene);
        self._prevSlideIn = !!this._slideIn;
      };
    }

    _updateInputTracking(scene) {
      this._prevKeyState = {...this._keyState};
      this._prevMouseDown = this._mouseDown;
      this._keyState = {...this._globalKeyState};
      if (scene.input && scene.input.keyboard) {
        const keyboard = scene.input.keyboard;
        const directKeys = {
          'a': scene._aKey,
          'd': scene._dKey,
          'space': scene._spaceKey,
          'up': scene._upKey,
          'w': scene._wKey,
          'left': scene._leftKey,
          'right': scene._rightKey,
          'esc': scene._escKey,
          'r': scene._restartKey,
          'p': scene._practiceKey,
          'z': scene._saveCheckpointKey,
          'x': scene._deleteCheckpointKey
        };
        for (const [name, keyObj] of Object.entries(directKeys)) {
          if (keyObj) this._keyState[name] = !!keyObj.isDown;
        }
        if (keyboard.keys) {
          for (const key of keyboard.keys) {
            if (!key) continue;
            const code = String(key.keyCode || key.key || '').toLowerCase();
            if (code && !(code in this._keyState)) {
              this._keyState[code] = !!key.isDown;
            }
          }
        }
      }
      this._mouseDown = !!(scene.input && scene.input.activePointer && scene.input.activePointer.isDown);
      this._pointerDownThisFrame = this._mouseDown && !this._prevMouseDown;
    }

    _updateCollisionTracking(scene) {
      if (!scene._player || !scene._player.p) return;
      const p = scene._player.p;
      if (p.diedThisFrame) {
        this._lastCollisionType = 2;
      } else if (p.collideTop !== 0 || p.collideBottom !== 0) {
        this._lastCollisionType = 1;
      } else {
        this._lastCollisionType = 0;
      }
    }

    _detectScene(scene) {
      if (scene._menuActive) return 'menu';
      if (window.isEditor) {
        if (scene._editorPlaytestActive && !scene._editorPlaytestPaused) return 'editgame';
        return 'edit';
      }
      if (scene._slideIn) return 'loadinglevel';
      if (scene._levelWon) return 'level_complete';
      if (scene._paused) return 'paused';
      return 'game';
    }

    _fireOnStart(prevScene, newScene) {
      this.sceneStarted.add(newScene);
      this._cleanupModTextsForScene(prevScene);
      if (newScene === 'menu' && !this.sceneStarted.has('menu')) {
        for (const mod of this.mods) {
          const handlers = mod.startHandlers.get('loading');
          if (Array.isArray(handlers)) {
            for (const handler of handlers) {
              try { handler(); } catch (e) {
                console.error('[ModLoader] Error in onstart(loading) for', mod.name, ':', e);
              }
            }
          }
        }
        this.sceneStarted.add('loading');
      }
      for (const mod of this.mods) {
        const handlers = mod.startHandlers;
        const sceneHandlers = handlers.get(newScene);
        if (sceneHandlers) {
          for (const handler of sceneHandlers) {
            try { handler(); } catch (e) {
              console.error('[ModLoader] Error in onstart for', mod.name, ':', e);
            }
          }
        }
        const allHandlers = handlers.get('all');
        if (allHandlers && !this.sceneStarted.has('all')) {
          for (const handler of allHandlers) {
            try { handler(); } catch (e) {
              console.error('[ModLoader] Error in onstart(all) for', mod.name, ':', e);
            }
          }
          this.sceneStarted.add('all');
        }
      }
    }

    _fireUpdate(scene) {
      for (const mod of this.mods) {
        const handlers = mod.updateHandlers;
        const sceneHandlers = handlers.get(scene);
        if (sceneHandlers) {
          for (const handler of sceneHandlers) {
            try { handler(); } catch (e) {
              console.error('[ModLoader] Error in update for', mod.name, ':', e);
            }
          }
        }
        const allHandlers = handlers.get('all');
        if (allHandlers) {
          for (const handler of allHandlers) {
            try { handler(); } catch (e) {
              console.error('[ModLoader] Error in update(all) for', mod.name, ':', e);
            }
          }
        }
      }
    }

    jsCall(method, ...args) {
      if (method === 'player.collision') return this._getPlayerCollision();
      if (method === 'player.alive') return this._setPlayerAlive(args[0]);
      if (method === 'player.get_gm') return this._getPlayerGm();
      if (method === 'player.set_gm') return this._setPlayerGm(args[0]);
      if (method === 'player.get_x') return this._getPlayerX();
      if (method === 'player.set_x') return this._setPlayerX(args[0]);
      if (method === 'player.get_y') return this._getPlayerY();
      if (method === 'player.set_y') return this._setPlayerY(args[0]);
      if (method === 'player.get_speed') return this._getPlayerSpeed();
      if (method === 'player.set_speed') return this._setPlayerSpeed(args[0]);
      if (method === 'player.set_direction') return this._setPlayerDirection(args[0]);
      if (method === 'player.freefly') return this._setPlayerFreefly(args[0]);
      if (method === 'game.set_var') return this._setGameVar(args[0], args[1]);
      if (method === 'game.get_var') return this._getGameVar(args[0]);
      if (method === 'game.set_color_channel') return this._setColorChannel(args[0], args[1], args[2], args[3]);
      if (method === 'game.get_color_channel') return this._getColorChannel(args[0]);
      if (method === 'game.level_name') return this._getLevelName();
      if (method === 'game.set_level_name') return this._setLevelName(args[0]);
      if (method === 'game.level_id') return this._getLevelId();
      if (method === 'game.set_level_id') return this._setLevelId(args[0]);
      if (method === 'game.song_id') return this._getSongId();
      if (method === 'game.set_song_id') return this._setSongId(args[0]);
      if (method === 'game.song_name') return this._getSongName();
      if (method === 'game.current_menu') return this._getCurrentMenu();
      if (method === 'game.open_menu') return this._openMenu(args[0]);
      if (method === 'game.return_to_menu') return this._returnToMenu();
      if (method === 'input.key_down') return this._keyDown(args[0]);
      if (method === 'input.key_pressed') return this._keyPressed(args[0]);
      if (method === 'input.mouse_x') return this._mouseX();
      if (method === 'input.mouse_y') return this._mouseY();
      if (method === 'input.mouse_down') return this._mouseDown();
      if (method === 'js.run') return this._runJs(args[0]);
      if (method === 'loading.set_tip') return this._setLoadingTip(args[0]);
      if (method === 'loading.show') return this._showOverlay();
      if (method === 'loading.hide') return this._hideOverlay();
      if (method === 'text.add') return this._textAdd(args[0], args[1], args[2], args[3], args[4], args[5], args[6]);
      if (method === 'text.remove') return this._textRemove(args[0]);
      if (method === 'text.update') return this._textUpdate(args[0], args[1]);
      if (method === 'ui.container') return this._uiCreateContainer(args[0], args[1]);
      if (method === 'ui.destroy') return this._uiDestroyContainer(args[0]);
      if (method === 'ui.button') return this._uiAddButton(args[0], args[1], args[2], args[3], args[4]);
      if (method === 'ui.image_button') return this._uiAddImageButton(args[0], args[1], args[2], args[3], args[4]);
      if (method === 'ui.text') return this._uiAddText(args[0], args[1], args[2], args[3], args[4], args[5], args[6]);
      if (method === 'ui.visible') return this._uiSetVisible(args[0], args[1]);
      if (method === 'ui.register_callback') return this._uiRegisterCallback(args[0]);
      if (method === 'ui.trigger_upload') return this._triggerFileUpload();
      if (method === 'ui.on_uploaded') return this._setUploadCallback(args[0]);
      if (method === 'html.panel') return this._htmlCreatePanel(args[0], args[1], args[2], args[3], args[4]);
      if (method === 'html.button') return this._htmlAddButton(args[0], args[1], args[2]);
      if (method === 'html.label') return this._htmlAddLabel(args[0], args[1]);
      if (method === 'html.input') return this._htmlAddInput(args[0], args[1], args[2]);
      if (method === 'html.destroy') return this._htmlDestroyPanel(args[0]);
      if (method === 'html.show') return this._htmlShowPanel(args[0]);
      if (method === 'html.hide') return this._htmlHidePanel(args[0]);
      if (method === 'storage.save') return this._storageSaveMod(args[0], args[1]);
      if (method === 'storage.list') return this._storageListMods();
      if (method === 'storage.delete') return this._storageDeleteMod(args[0]);
      if (method === 'storage.load') return this._storageLoadMod(args[0]);
      if (method === 'storage.run') return this._storageRunMod(args[0]);
      if (method === 'texture.list_packs') return this._textureListPacks();
      if (method === 'texture.add_pack') return this._textureAddPack(args[0]);
      if (method === 'texture.delete_pack') return this._textureDeletePack(args[0]);
      if (method === 'texture.apply_pack') return this._textureApplyPack(args[0]);
      if (method === 'texture.get_active') return this._textureGetActive();
      if (method === 'texture.get_info') return this._textureGetInfo(args[0]);
      if (method === 'texture.trigger_upload') return this._textureTriggerUpload();
      console.warn('[ModLoader] Unknown JS call:', method);
      return null;
    }

    _getPlayerAlive() {
      const scene = this._gameScene;
      if (!scene || !scene._player) return true;
      return !scene._player.p.isDead;
    }

    _setPlayerAlive(value) {
      const makeAlive = !!value;
      const scene = this._gameScene;
      if (!scene || !scene._player) return makeAlive;
      if (!makeAlive) {
        if (!scene._player.p.isDead) scene._player.killPlayer?.();
        return false;
      }
      if (!scene._player.p.isDead) return true;
      return this._revivePlayer();
    }

    _revivePlayer() {
      const scene = this._gameScene;
      if (!scene || !scene._player) return false;
      const player = scene._player;
      const p = player.p;

      p.isDead = false;
      if (player._deathTimer) player._deathTimer = 0;

      if (typeof player._cleanupExplosion === 'function') {
        player._cleanupExplosion();
      }

      if (player._dashAnimationSprite) player._dashAnimationSprite.setVisible(false);
      player._dashAnimationFrame = 0;
      player._dashAnimationTimer = 0;
      if (player._spiderDashEffectSprite) player._spiderDashEffectSprite.setVisible(false);
      player._spiderDashEffectTimer = 0;
      if (typeof player._hideRobotJumpFlame === 'function') player._hideRobotJumpFlame();
      player._robotJumpFlameActive = false;
      player._robotJumpFlamePulse = 0;
      player._robotJumpFlameFadeInTimer = 0;

      if (player._spiderTeleportCircles?.length) {
        for (const circle of player._spiderTeleportCircles) if (circle?.destroy) circle.destroy();
        player._spiderTeleportCircles = [];
      }

      player.setCubeVisible(!p.isFlying && !p.isBall && !p.isWave && !p.isUfo && !p.isSpider && !p.isBird && !p.isDart && !p.isRobot && !p.isSwing && !p.isJetpack);
      player.setShipVisible(!!p.isFlying || !!p.isUfo);
      player.setBallVisible(!!p.isBall);
      player.setWaveVisible(!!p.isWave);
      player.setSpiderVisible(!!p.isSpider);
      if (typeof player.setBirdVisible === 'function') player.setBirdVisible(!!p.isBird);
      player.setRobotVisible(!!p.isRobot);

      player._hitboxTrail = [];
      if (player._hitboxGraphics?.clear) player._hitboxGraphics.clear();

      if (typeof scene.toggleGlitter === 'function') scene.toggleGlitter(true);

      return true;
    }

    _getPlayerGm() {
      const scene = this._gameScene;
      if (!scene || !scene._player) return 0;
      const p = scene._player.p;
      if (p.isBall) return 2;
      if (p.isWave) return 3;
      if (p.isUfo) return 4;
      if (p.isSpider) return 5;
      if (p.isRobot) return 6;
      if (p.isBird || p.isDart || p.isSwing || p.isJetpack) return 7;
      if (p.isFlying) return 1;
      return 0;
    }

    _setPlayerGm(mode) {
      const scene = this._gameScene;
      if (!scene || !scene._player) return false;
      const player = scene._player;
      const p = player.p;

      const modeNum = Number(mode) || 0;

      if (modeNum === 0) {
        player.exitShipMode?.();
        player.exitBallMode?.();
        player.exitWaveMode?.();
        player.exitUfoMode?.();
        player.exitSpiderMode?.();
        player.exitRobotMode?.();
        player.setCubeVisible(true);
        player._setGamemodeFlyBounds?.(false, 0);
      } else if (modeNum === 7) {
        player.exitShipMode?.();
        player.exitBallMode?.();
        player.exitWaveMode?.();
        player.exitUfoMode?.();
        player.exitSpiderMode?.();
        player.exitRobotMode?.();
        p.isBird = true;
        player.setCubeVisible(true);
        if (player.setBirdVisible) player.setBirdVisible(true);
        player._setGamemodeFlyBounds?.(false, 0);
      } else {
        const enterMap = {
          1: 'enterShipMode',
          2: 'enterBallMode',
          3: 'enterWaveMode',
          4: 'enterUfoMode',
          5: 'enterSpiderMode',
          6: 'enterRobotMode'
        };
        const method = enterMap[modeNum];
        if (method && player[method]) {
          player[method](null);
        }
      }

      return true;
    }

    _getPlayerX() {
      const scene = this._gameScene;
      if (!scene || !scene._player) return 0;
      return scene._player.p.x;
    }

    _setPlayerX(value) {
      const scene = this._gameScene;
      if (!scene || !scene._player) return false;
      scene._player.p.x = Number(value);
      return true;
    }

    _getPlayerY() {
      const scene = this._gameScene;
      if (!scene || !scene._player) return 0;
      return scene._player.p.y;
    }

    _setPlayerY(value) {
      const scene = this._gameScene;
      if (!scene || !scene._player) return false;
      scene._player.p.y = Number(value);
      return true;
    }

    _getPlayerSpeed() {
      try {
        return this._runJs('typeof playerSpeed !== "undefined" ? playerSpeed : null');
      } catch (e) {
        return null;
      }
    }

    _setPlayerSpeed(value) {
      try {
        this._runJs(`playerSpeed = ${Number(value)};`);
        return true;
      } catch (e) {
        console.error('[ModLoader] set_speed error:', e);
        return false;
      }
    }

    _setPlayerDirection(direction) {
      const scene = this._gameScene;
      if (!scene || !scene._player) return false;
      const dir = String(direction).toLowerCase();
      const targetMirrored = dir === 'left';
      const player = scene._player;
      const p = player.p;
      if (p.mirrored === targetMirrored) return true;
      p.mirrored = targetMirrored;
      const layers = player._allLayers || player._playerLayers || [];
      for (const layer of layers) {
        if (!layer || !layer.sprite || !layer.sprite.setScaleX) continue;
        const currentScaleX = layer.sprite.scaleX;
        const absScale = Math.abs(currentScaleX);
        if (absScale < 0.001) continue;
        const newScaleX = targetMirrored ? -absScale : absScale;
        layer.sprite.setScaleX(newScaleX);
      }
      return true;
    }

    _setPlayerFreefly(enabled) {
      const scene = this._gameScene;
      if (!scene || !scene._player) return false;
      const enable = !!enabled;
      window.noClip = enable;
      window.freeFly = enable;
      if (enable) {
        this._setPlayerGm(1);
      } else {
        this._setPlayerGm(0);
        if (scene._level && typeof scene._level.setFlyMode === 'function') {
          scene._level.setFlyMode(false);
        }
      }
      return true;
    }

    _setGameVar(name, value) {
      if (typeof window !== 'undefined') window[name] = value;
      return true;
    }

    _getGameVar(name) {
      if (typeof window !== 'undefined') return window[name];
      return undefined;
    }

    _getLevelName() {
      return window.currentlevel?.[1] || null;
    }

    _setLevelName(value) {
      if (window.currentlevel && Array.isArray(window.currentlevel)) window.currentlevel[1] = value;
      return true;
    }

    _getLevelId() {
      return window.currentlevel?.[2] || null;
    }

    _setLevelId(value) {
      if (window.currentlevel && Array.isArray(window.currentlevel)) window.currentlevel[2] = value;
      return true;
    }

    _getSongId() {
      return window.currentlevel?.[0] || null;
    }

    _setSongId(value) {
      if (window.currentlevel && Array.isArray(window.currentlevel)) window.currentlevel[0] = value;
      return true;
    }

    _getSongName() {
      return window.currentlevel?.[3]?.[1] || null;
    }

    _getCurrentMenu() {
      const scene = this._gameScene;
      if (!scene) return 'unknown';
      if (scene._menuActive) {
        if (scene._levelSelectOverlay) return 'level_select';
        if (scene._playOverlay) return 'play_menu';
        if (scene._creatorOverlay) return 'creator_menu';
        if (scene._iconOverlay) return 'icon_selector';
        if (scene._searchOverlay) return 'search';
        if (scene._onlineLevelsOverlay) return 'online_levels';
        if (scene._infoPopup) return 'info_popup';
        if (scene._settingsPopup || scene._settingsScreenClosing) return 'settings';
        if (scene._statsPopup) return 'stats';
        if (scene._updateLogPopup) return 'update_log';
        if (scene._editorOverlay) return 'editor';
        return 'main_menu';
      }
      if (window.isEditor) {
        if (scene._editorPlaytestActive) return 'editgame';
        return 'editor';
      }
      if (scene._slideIn) return 'loading';
      if (scene._levelWon) return 'level_complete';
      if (scene._paused) return 'paused';
      return 'game';
    }

    _openMenu(menuName) {
      const scene = this._gameScene;
      if (!scene) return false;
      const menu = String(menuName).toLowerCase();

      const openers = {
        'main_menu': () => scene.scene.restart(),
        'level_select': () => scene._openLevelSelect?.(),
        'play_menu': () => scene._openPlayMenu?.(),
        'creator_menu': () => scene._openCreatorMenu?.(),
        'icon_selector': () => scene._openIconSelector?.('icon'),
        'search': () => scene._openSearchMenu?.(),
        'online_levels': () => scene._openOnlineLevelsScene?.({}),
        'settings': () => scene._showSettingsScreen?.(),
        'stats': () => scene._showStatsScreen?.(),
        'editor': () => { if (typeof window !== 'undefined') window.isEditor = true; },
        'game': () => { scene.scene.restart(); }
      };

      const opener = openers[menu];
      if (opener) {
        try { opener(); return true; } catch (e) { console.error('[ModLoader] open_menu error:', e); }
      }
      return false;
    }

    _keyDown(key) {
      return !!this._keyState[String(key).toLowerCase()];
    }

    _keyPressed(key) {
      const keyLower = String(key).toLowerCase();
      return !!this._keyState[keyLower] && !this._prevKeyState[keyLower];
    }

    _mouseX() {
      const scene = this._gameScene;
      if (!scene || !scene.input) return 0;
      return scene.input.activePointer?.x || 0;
    }

    _mouseY() {
      const scene = this._gameScene;
      if (!scene || !scene.input) return 0;
      return scene.input.activePointer?.y || 0;
    }

    _mouseDown() {
      return this._mouseDown;
    }

    _runJs(code) {
      try {
        return new Function(code)();
      } catch (e) {
        console.error('[ModLoader] js.run error:', e);
        return null;
      }
    }

    _setLoadingTip(text) {
      this._updateOverlay(text);
    }

    _textAdd(sceneName, x, y, text, font, size, color) {
      const scene = this._resolveScene(sceneName);
      if (!scene) return null;
      const safeX = Number(x) || 0;
      const safeY = Number(y) || 0;
      const safeSize = Number(size) || 30;
      const safeText = String(text ?? '');
      const safeFont = String(font || 'bigFont');
      const safeColor = String(color || '#ffffff');

      let textObj = null;
      try {
        textObj = scene.add.bitmapText(safeX, safeY, safeFont, safeText, safeSize);
        textObj.setOrigin(0, 0);
        textObj.setScrollFactor(0);
        textObj.setDepth(900);
      } catch (e) {
        console.error('[ModLoader] text.add error:', e);
        return null;
      }

      const textId = this._nextTextId++;
      this._modTexts.set(textId, { scene, textObj, sceneName });
      return textId;
    }

    _textRemove(textId) {
      const entry = this._modTexts.get(Number(textId));
      if (!entry) return false;
      try { entry.textObj.destroy(); } catch (e) {}
      this._modTexts.delete(Number(textId));
      return true;
    }

    _textUpdate(textId, newText) {
      const entry = this._modTexts.get(Number(textId));
      if (!entry) return false;
      try { entry.textObj.setText(String(newText ?? '')); } catch (e) { return false; }
      return true;
    }

    _uiCreateContainer(x, y) {
      const scene = this._gameScene;
      if (!scene) return null;
      const container = scene.add.container(Number(x) || 0, Number(y) || 0).setScrollFactor(0).setDepth(900);
      const id = this._nextUiId++;
      this._uiContainers.set(id, container);
      return id;
    }

    _uiDestroyContainer(containerId) {
      const container = this._uiContainers.get(Number(containerId));
      if (!container) return false;
      try { container.destroy(); } catch (e) {}
      this._uiContainers.delete(Number(containerId));
      return true;
    }

    _uiAddButton(containerId, x, y, text, callbackId) {
      const container = this._uiContainers.get(Number(containerId));
      if (!container) return null;
      const scene = this._gameScene;
      if (!scene) return null;
      const btn = scene.add.image(Number(x) || 0, Number(y) || 0, "GJ_WebSheet", "GJ_button_001.png")
        .setOrigin(0.5, 0.5)
        .setInteractive();
      const label = scene.add.bitmapText(0, 0, "bigFont", String(text || ''), 28).setOrigin(0.5, 0.5);
      container.add([btn, label]);
      const id = Number(callbackId);
      btn.on('pointerup', () => {
        try {
          const cb = this.pyodide.globals.get('_get_ui_callback');
          if (cb) {
            const callback = cb(id);
            if (callback) callback();
          }
        } catch (e) { console.error('[ModLoader] UI callback error:', e); }
      });
      return true;
    }

    _uiAddImageButton(containerId, x, y, texture, callbackId, width, height) {
      const container = this._uiContainers.get(Number(containerId));
      if (!container) return null;
      const scene = this._gameScene;
      if (!scene) return null;
      const texKey = String(texture || 'GJ_WebSheet');
      if (!scene.textures.exists(texKey)) {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            scene.textures.addCanvas(texKey, canvas);
            const existing = scene._pendingImageButtons?.[texKey];
            if (existing) {
              for (const btnData of existing) {
                this._createImageButton(btnData.container, btnData.x, btnData.y, texKey, btnData.callbackId, btnData.width, btnData.height);
              }
              delete scene._pendingImageButtons[texKey];
            }
          } catch (err) {
            console.error('[ModLoader] Failed to register texture:', texKey, err);
          }
        };
        img.onerror = () => console.error('[ModLoader] Failed to load image:', texKey);
        img.src = '/assets/sprites/' + texKey + '.png';
      }
      if (scene.textures.exists(texKey)) {
        return this._createImageButton(container, Number(x) || 0, Number(y) || 0, texKey, Number(callbackId), Number(width), Number(height));
      }
      if (!scene._pendingImageButtons) scene._pendingImageButtons = {};
      if (!scene._pendingImageButtons[texKey]) scene._pendingImageButtons[texKey] = [];
      scene._pendingImageButtons[texKey].push({ container, x: Number(x) || 0, y: Number(y) || 0, callbackId: Number(callbackId), width: Number(width), height: Number(height) });
      return true;
    }

    _createImageButton(container, x, y, texKey, callbackId, width, height) {
      const scene = this._gameScene;
      if (!scene || !scene.textures.exists(texKey)) return null;
      const btn = scene.add.image(x, y, texKey)
        .setOrigin(0.5, 0.5)
        .setInteractive();
      if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
        btn.setDisplaySize(width, height);
      }
      container.add(btn);
      btn.on('pointerup', () => {
        try {
          const cb = this.pyodide.globals.get('_get_ui_callback');
          if (cb) {
            const callback = cb(callbackId);
            if (callback) callback();
          }
        } catch (e) { console.error('[ModLoader] UI callback error:', e); }
      });
      return true;
    }

    _uiAddText(containerId, x, y, text, font, size, color) {
      const container = this._uiContainers.get(Number(containerId));
      if (!container) return null;
      const scene = this._gameScene;
      if (!scene) return null;
      const txt = scene.add.bitmapText(Number(x) || 0, Number(y) || 0, String(font || 'bigFont'), String(text || ''), Number(size) || 30).setOrigin(0.5, 0.5);
      container.add(txt);
      return true;
    }

    _uiSetVisible(containerId, visible) {
      const container = this._uiContainers.get(Number(containerId));
      if (!container) return false;
      container.setVisible(!!visible);
      return true;
    }

    _uiRegisterCallback(callback) {
      const id = this._nextCallbackId++;
      this._uiCallbacks.set(id, callback);
      return id;
    }

    _uiDestroyContainer(containerId) {
      const container = this._uiContainers.get(Number(containerId));
      if (!container) return false;
      try { container.destroy(); } catch (e) {}
      this._uiContainers.delete(Number(containerId));
      return true;
    }

    _htmlCreatePanel(x, y, width, height, title) {
      const panel = document.createElement('div');
      panel.className = 'crystal-html-panel';
      panel.style.left = Number(x) + 'px';
      panel.style.top = Number(y) + 'px';
      panel.style.width = Number(width) + 'px';
      panel.style.minHeight = Number(height) + 'px';
      panel.style.maxHeight = '90vh';
      panel.style.overflowY = 'auto';
      panel.style.boxSizing = 'border-box';
      if (title) {
        const titleEl = document.createElement('h3');
        titleEl.textContent = String(title);
        panel.appendChild(titleEl);
      }
      const id = this._nextHtmlId++;
      this._htmlContainers.set(id, panel);
      document.body.appendChild(panel);
      return id;
    }

    _htmlAddButton(panelId, text, callbackId) {
      const panel = this._htmlContainers.get(Number(panelId));
      if (!panel) return null;
      const btn = document.createElement('button');
      btn.className = 'crystal-html-button';
      btn.textContent = String(text);
      const id = Number(callbackId);
      btn.addEventListener('click', () => {
        try {
          const cb = this.pyodide.globals.get('_get_html_callback');
          if (cb) {
            const callback = cb(id);
            if (callback) callback();
          }
        } catch (e) { console.error('[ModLoader] HTML callback error:', e); }
      });
      panel.appendChild(btn);
      return true;
    }

    _htmlAddLabel(panelId, text) {
      const panel = this._htmlContainers.get(Number(panelId));
      if (!panel) return null;
      const label = document.createElement('div');
      label.className = 'crystal-html-label';
      label.textContent = String(text);
      panel.appendChild(label);
      return true;
    }

    _htmlAddInput(panelId, placeholder, callbackId) {
      const panel = this._htmlContainers.get(Number(panelId));
      if (!panel) return null;
      const input = document.createElement('input');
      input.className = 'crystal-html-input';
      input.type = 'text';
      input.placeholder = String(placeholder || '');
      const id = Number(callbackId);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          try {
            const cb = this.pyodide.globals.get('_get_html_callback');
            if (cb) {
              const callback = cb(id);
              if (callback) callback(input.value);
            }
          } catch (err) { console.error('[ModLoader] HTML input callback error:', err); }
        }
      });
      panel.appendChild(input);
      return true;
    }

    _htmlDestroyPanel(panelId) {
      const panel = this._htmlContainers.get(Number(panelId));
      if (!panel) return false;
      try { panel.remove(); } catch (e) {}
      this._htmlContainers.delete(Number(panelId));
      return true;
    }

    _htmlShowPanel(panelId) {
      const panel = this._htmlContainers.get(Number(panelId));
      if (!panel) return false;
      panel.style.display = 'block';
      return true;
    }

    _htmlHidePanel(panelId) {
      const panel = this._htmlContainers.get(Number(panelId));
      if (!panel) return false;
      panel.style.display = 'none';
      return true;
    }

    _storageSaveMod(name, code) {
      try {
        const stored = JSON.parse(localStorage.getItem('crystal_mods') || '{}');
        stored[String(name)] = String(code);
        localStorage.setItem('crystal_mods', JSON.stringify(stored));
        return true;
      } catch (e) {
        console.error('[ModLoader] storage save error:', e);
        return false;
      }
    }

    _storageListMods() {
      try {
        const stored = JSON.parse(localStorage.getItem('crystal_mods') || '{}');
        return Object.keys(stored);
      } catch (e) {
        return [];
      }
    }

    _storageDeleteMod(name) {
      try {
        const stored = JSON.parse(localStorage.getItem('crystal_mods') || '{}');
        delete stored[String(name)];
        localStorage.setItem('crystal_mods', JSON.stringify(stored));
        return true;
      } catch (e) {
        return false;
      }
    }

    _storageLoadMod(name) {
      try {
        const stored = JSON.parse(localStorage.getItem('crystal_mods') || '{}');
        return stored[String(name)] || null;
      } catch (e) {
        return null;
      }
    }

    _storageRunMod(name) {
      const code = this._storageLoadMod(name);
      if (!code) return false;
      return this._executeModCode(name, code);
    }

    _textureListPacks() {
      const packsDir = '/mods/texture_packs';
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', packsDir, false);
        xhr.send(null);
        if (xhr.status !== 200) {
          alert('Unable to load texture packs directory');
          return [];
        }
        const text = xhr.responseText;
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
        const links = doc.querySelectorAll('a');
        const packs = [];
        for (const link of links) {
          const href = link.getAttribute('href') || '';
          const name = href.replace(/\/$/, '');
          if (!name || name === '..' || name === '.') continue;
          packs.push(name);
        }
        return packs;
      } catch (e) {
        alert('Failed to list texture packs: ' + e.message);
        return [];
      }
    }

    _textureAddPack(file) {
      if (!file) {
        alert('No file selected');
        return { success: false };
      }
      try {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
          try {
            const packs = JSON.parse(localStorage.getItem('crystal_texture_packs') || '{}');
            const packName = file.name.replace(/\.zip$/i, '');
            packs[packName] = { data: reader.result, date: Date.now() };
            localStorage.setItem('crystal_texture_packs', JSON.stringify(packs));
            alert('Texture pack added: ' + packName);
          } catch (e) {
            alert('Failed to save texture pack: ' + e.message);
          }
        };
        reader.onerror = () => alert('Failed to read texture pack file');
        return { success: true };
      } catch (e) {
        alert('Texture pack upload failed: ' + e.message);
        return { success: false };
      }
    }

    _textureDeletePack(packName) {
      try {
        const packs = JSON.parse(localStorage.getItem('crystal_texture_packs') || '{}');
        delete packs[packName];
        localStorage.setItem('crystal_texture_packs', JSON.stringify(packs));
        alert('Texture pack deleted: ' + packName);
        return { success: true };
      } catch (e) {
        alert('Texture pack delete failed: ' + e.message);
        return { success: false };
      }
    }

    _textureApplyPack(packName) {
      const packsDir = '/mods/texture_packs';
      try {
        const metaRes = new XMLHttpRequest();
        metaRes.open('GET', packsDir + '/' + packName + '/pack.json', false);
        metaRes.send(null);
        if (metaRes.status !== 200) {
          alert('Texture pack not found: ' + packName);
          return { success: false };
        }
        const metadata = JSON.parse(metaRes.responseText);
        window._currentTexturePack = packName;
        window._texturePackDir = packsDir + '/' + packName;
        alert('Applied texture pack: ' + (metadata.name || packName));
        return { success: true, metadata };
      } catch (e) {
        alert('Failed to apply texture pack: ' + e.message);
        return { success: false };
      }
    }

    _textureGetActive() {
      return window._currentTexturePack || null;
    }

    _textureGetInfo(packName) {
      const packsDir = '/mods/texture_packs';
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', packsDir + '/' + packName + '/pack.json', false);
        xhr.send(null);
        if (xhr.status !== 200) return null;
        return JSON.parse(xhr.responseText);
      } catch (e) {
        return null;
      }
    }

    _textureTriggerUpload() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.zip,application/zip';
      input.style.display = 'none';
      input.addEventListener('change', () => {
        const file = input.files[0];
        if (!file) return;
        this._textureAddPack(file);
        input.remove();
      });
      document.body.appendChild(input);
      input.click();
    }

    _setupFileUpload() {
      if (this._modFileInput) return;
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.py';
      input.style.display = 'none';
      input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
          const code = ev.target.result;
          const name = file.name;
          this._storageSaveMod(name, code);
          await this._executeModCode(name, code);
          this._updateOverlay('Loaded mod: ' + name);
          if (this._onModUploaded) {
            try { this._onModUploaded(name); } catch (err) { console.error('[ModLoader] onModUploaded error:', err); }
          }
        };
        reader.readAsText(file);
        input.value = '';
      });
      document.body.appendChild(input);
      this._modFileInput = input;
    }

    _triggerFileUpload() {
      if (!this._modFileInput) this._setupFileUpload();
      if (this._modFileInput) this._modFileInput.click();
    }

    _setUploadCallback(callback) {
      this._onModUploaded = callback;
      return true;
    }

    async _executeModCode(name, code) {
      try {
        this.pyodide.runPython(code);
        this.pyodide.runPython(`
if 'mod' in dir():
    _mod_loader_mod_obj = mod
else:
    _mod_loader_mod_obj = None
`);
        const modObj = this.pyodide.globals.get('_mod_loader_mod_obj');
        if (!modObj) {
          console.warn('[ModLoader] No mod object found in', name);
          return false;
        }
        modObj._set_bridge({
          call: (method, ...args) => this.jsCall(method, ...args),
          log: (msg) => console.log('[Mod]', msg)
        });
        this.mods.push({
          name: name,
          startHandlers: modObj._start_handlers,
          updateHandlers: modObj._update_handlers
        });
        console.log('[ModLoader] Registered mod:', name, '- total:', this.mods.length);
        return true;
      } catch (e) {
        console.error('[ModLoader] Failed to execute mod', name, ':', e);
        return false;
      }
    }

    _resolveScene(name) {
      return this._gameScene;
    }

    _cleanupModTextsForScene(sceneName) {
      if (!sceneName) return;
      for (const [id, entry] of this._modTexts) {
        if (entry.sceneName === sceneName) {
          try { entry.textObj.destroy(); } catch (e) {}
          this._modTexts.delete(id);
        }
      }
    }

    _returnToMenu() {
      const scene = this._gameScene;
      if (!scene) return false;
      try {
        scene.scene.restart();
        return true;
      } catch (e) {
        console.error('[ModLoader] return_to_menu error:', e);
        return false;
      }
    }

    _getPlayerCollision() {
      if (this._lastCollisionType === 0) return null;
      return { type: this._lastCollisionType };
    }
  }

  function bootModLoader() {
    if (window._modLoader) return;
    window._modLoader = new ModLoader();
    window._modLoader.init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootModLoader);
  } else {
    bootModLoader();
  }
})();
