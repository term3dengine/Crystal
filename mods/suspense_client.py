from crystal import Crystal

mod = Crystal()

loadScene = "all"

oldgm = 1

_suspense_panel = None
_suspense_state = {
    "noclip": False,
    "hitboxes": False,
    "practice": False,
    "infinite_jump": False,
    "fly": False,
    "size": 1.0,
    "gravity": 1.0,
    "auto_jump": False,
    "auto_play": False,
    "kill_on_touch": False,
    "platformer": False,
    "hitboxtrail": False,
    "speedhack": False,
    "speedhack_value": 1.0,
    "macro_bot": False,
    "trajectory": False,
    "swap_texture": False,
    "swap_sound": False,
}

_platformer_direction = None
_swap_texture_key = None
_swap_texture_url = None
_swap_sound_key = None
_swap_sound_url = None

def _list_packs():
    return mod.texture.list_packs() or []

def _add_pack(file_data):
    return mod.texture.add_pack(file_data)

def _delete_pack(pack_name):
    return mod.texture.delete_pack(pack_name)

def _apply_pack(pack_name):
    return mod.texture.apply_pack(pack_name)

def _get_active_pack():
    return mod.texture.get_active()

def _get_pack_info(pack_name):
    return mod.texture.get_info(pack_name)

def _apply_platformer():
    global _platformer_direction
    if not _suspense_state["platformer"]:
        mod.player.set_speed(11.540004)
        return
    if mod.input.key_down("d"):
        mod.player.set_speed(11.540004)
        if _platformer_direction != "right":
            #mod.player.set_direction("right")
            _platformer_direction = "right"
    elif mod.input.key_down("a"):
        mod.player.set_speed(-11.540004)
        if _platformer_direction != "left":
            #mod.player.set_direction("left")
            _platformer_direction = "left"
    else:
        mod.player.set_speed(0)

@mod.onstart(loadScene)
def on_game_start():
    create_suspense_actions()
    apply_all_suspense()

@mod.onstart("loadinglevel")
def on_loading_start():
    apply_all_suspense()

@mod.onstart("level_complete")
def on_level_complete():
    apply_all_suspense()

@mod.update(loadScene)
def update():
    global _suspense_panel
    if mod.input.key_pressed("e"):
        if _suspense_panel is None:
            open_suspense_menu()
        else:
            close_suspense_menu()
    apply_all_suspense()

@mod.update("editgame")
def edit_update():
    apply_all_suspense()

def apply_all_suspense():
    if _suspense_state["noclip"]:
        mod.js.run("window.noClip = true")
    if _suspense_state["hitboxes"]:
        mod.js.run("window.showHitboxes = true")
    if _suspense_state["hitboxtrail"]:
        mod.js.run("window.showHitboxTrail = true")
    if _suspense_state["size"] != 1.0:
        mod.js.run(f"""
if (window._player && window._player.p) {{
    window._player.p.isMini = {str(_suspense_state['size'] < 1.0).lower()};
}}
""")
    if _suspense_state["gravity"] != 1.0:
        mod.js.run(f"""
if (window._player && window._player.p) {{
    window._player.p.gravity = {_suspense_state['gravity']};
}}
""")
    if _suspense_state["speedhack"]:
        mod.js.run(f"window.speedHack = {_suspense_state['speedhack_value']}")
    if _suspense_state["trajectory"]:
        mod.js.run("""
if (window._player && window._player.p) {
    const player = window._player;
    const state = player.p;
    if (!window._trajectoryGfx) {
        window._trajectoryGfx = player.scene.add.graphics();
        window._trajectoryGfx.setDepth(999);
    }
    window._trajectoryGfx.clear();
    const startX = player.x;
    const startY = player.y;
    let x = startX;
    let y = startY;
    let vx = state.xVelocity || 0;
    let vy = state.yVelocity || 0;
    const gravity = state.gravity || 1;
    const dt = 1 / 60;
    const steps = 90;
    window._trajectoryGfx.lineStyle(2, 0x00ff00, 0.8);
    window._trajectoryGfx.beginPath();
    window._trajectoryGfx.moveTo(x, y);
    for (let i = 0; i < steps; i++) {
        vy += gravity * 0.5;
        x += vx * dt * 60;
        y += vy * dt * 60;
        window._trajectoryGfx.lineTo(x, y);
        if (y > 600 || y < -100 || x < -100 || x > 9999) break;
    }
    window._trajectoryGfx.strokePath();
} else if (window._trajectoryGfx) {
    window._trajectoryGfx.clear();
}
""")
    apply_hacks()
    if _suspense_state["platformer"]:
        _apply_platformer()

def create_suspense_actions():
    mod.js.run("""
window._suspenseActions = {
    toggle: function(key) {
        const map = {
            'noclip': () => { window.noClip = !window.noClip; },
            'hitboxes': () => { window.showHitboxes = !window.showHitboxes; },
            'hitboxtrail': () => { window.showHitboxTrail = !window.showHitboxTrail; },
            'practice': () => { if (window._practicedMode) window._practicedMode.togglePracticeMode(); },
            'kill_on_touch': () => {},
            'platformer': () => {},
            'trajectory': () => {},
            'speedhack': () => { window.speedHack = window.speedHack === 1 ? 2 : 1; },
            'auto_jump': () => {},
            'auto_play': () => {},
            'macro_bot': () => { window.macroBot = !window.macroBot; }
        };
        if (map[key]) map[key]();
    },
    cycle: function(key) {
        if (key === 'size') {
            const current = window._player && window._player.p ? (window._player.p.isMini ? 0.5 : 1.0) : 1.0;
            const sizes = [0.5, 1.0, 1.5, 2.0];
            let idx = sizes.indexOf(current);
            if (idx < 0) idx = 1;
            idx = (idx + 1) % sizes.length;
            if (window._player && window._player.p) {
                window._player.p.isMini = sizes[idx] < 1.0;
            }
        } else if (key === 'gravity') {
            const current = window._player && window._player.p ? window._player.p.gravity : 1;
            const gravities = [0.5, 1.0, 1.5, 2.0, 3.0];
            let idx = gravities.indexOf(current);
            if (idx < 0) idx = 1;
            idx = (idx + 1) % gravities.length;
            if (window._player && window._player.p) {
                window._player.p.gravity = gravities[idx];
            }
        }
    },
    setSpeedhack: function(value) {
        const val = parseFloat(value);
        if (!isNaN(val) && val > 0) {
            window.speedHack = val;
        }
    },
    setGamemode: function(mode) {
        if (window._player && window._player.setgm) {
            window._player.setgm(mode);
        }
    },
    getStatus: function() {
        const status = {};
        status['noclip'] = !!window.noClip;
        status['hitboxes'] = !!window.showHitboxes;
        status['hitboxtrail'] = !!window.showHitboxTrail;
        status['speedhack'] = window.speedHack !== 1;
        status['macro_bot'] = !!window.macroBot;
        if (window._player && window._player.p) {
            status['size'] = window._player.p.isMini ? 0.5 : 1.0;
            status['gravity'] = window._player.p.gravity;
        }
        return status;
    }
};
""")

def open_suspense_menu():
    global _suspense_panel
    if _suspense_panel is not None:
        mod.html.destroy(_suspense_panel)
    _suspense_panel = mod.html.panel(50, 50, 350, 520, "Suspense Client")
    refresh_suspense_menu()

def close_suspense_menu():
    global _suspense_panel
    if _suspense_panel is not None:
        mod.html.destroy(_suspense_panel)
        _suspense_panel = None

def refresh_suspense_menu():
    global _suspense_panel
    if _suspense_panel is None:
        return
    mod.html.destroy(_suspense_panel)
    _suspense_panel = mod.html.panel(50, 50, 350, 520, "Suspense Client")
    
    mod.html.label(_suspense_panel, "Player")
    mod.html.button(_suspense_panel, f"Noclip: {'ON' if _suspense_state['noclip'] else 'OFF'}", toggle_noclip)
    mod.html.button(_suspense_panel, f"Hitboxes: {'ON' if _suspense_state['hitboxes'] else 'OFF'}", toggle_hitboxes)
    mod.html.button(_suspense_panel, f"Hitbox Trail: {'ON' if _suspense_state['hitboxtrail'] else 'OFF'}", toggle_hitboxtrail)
    mod.html.button(_suspense_panel, f"Practice: {'ON' if _suspense_state['practice'] else 'OFF'}", toggle_practice)
    #mod.html.button(_suspense_panel, f"Infinite Jump: {'ON' if _suspense_state['infinite_jump'] else 'OFF'}", toggle_infinite_jump)
    mod.html.button(_suspense_panel, f"Kill on Touch: {'ON' if _suspense_state['kill_on_touch'] else 'OFF'}", toggle_kill_on_touch)
    mod.html.button(_suspense_panel, f"Platformer: {'ON' if _suspense_state['platformer'] else 'OFF'}", toggle_platformer)
    mod.html.button(_suspense_panel, f"Trajectory: {'ON' if _suspense_state['trajectory'] else 'OFF'}", toggle_trajectory)
    
    mod.html.label(_suspense_panel, "Movement")
    mod.html.button(_suspense_panel, f"Size: {_suspense_state['size']}x", cycle_size)
    mod.html.button(_suspense_panel, f"Gravity: {_suspense_state['gravity']}x", cycle_gravity)
    speedhack_label = f"Speedhack: {_suspense_state['speedhack_value']}x" if _suspense_state['speedhack'] else 'Speedhack: OFF'
    mod.html.button(_suspense_panel, speedhack_label, toggle_speedhack)
    if _suspense_state['speedhack']:
        mod.html.input(_suspense_panel, "Enter speed multiplier", set_speedhack_value)
    
    mod.html.label(_suspense_panel, "Automation")
    mod.html.button(_suspense_panel, f"Auto Jump: {'ON' if _suspense_state['auto_jump'] else 'OFF'}", toggle_auto_jump)
    mod.html.button(_suspense_panel, f"Auto Play: {'ON' if _suspense_state['auto_play'] else 'OFF'}", toggle_auto_play)
    mod.html.button(_suspense_panel, f"Macro Bot: {'ON' if _suspense_state['macro_bot'] else 'OFF'}", toggle_macro_bot)
    
    mod.html.label(_suspense_panel, "Asset Swap")
    mod.html.button(_suspense_panel, f"Swap Texture: {'ON' if _suspense_state['swap_texture'] else 'OFF'}", toggle_swap_texture)
    if _suspense_state['swap_texture']:
        mod.html.input(_suspense_panel, "Texture key", swap_texture_key)
        mod.html.input(_suspense_panel, "Texture URL", swap_texture_url)
        mod.html.button(_suspense_panel, "Upload Texture File", upload_texture_file)
    mod.html.button(_suspense_panel, f"Swap Sound: {'ON' if _suspense_state['swap_sound'] else 'OFF'}", toggle_swap_sound)
    if _suspense_state['swap_sound']:
        mod.html.input(_suspense_panel, "Sound key", swap_sound_key)
        mod.html.input(_suspense_panel, "Sound URL", swap_sound_url)
        mod.html.button(_suspense_panel, "Upload Sound File", upload_sound_file)
    
    mod.html.label(_suspense_panel, "Texture Packs")
    mod.html.button(_suspense_panel, "List Packs", list_texture_packs)
    mod.html.button(_suspense_panel, "Add Pack", add_texture_pack)
    mod.html.button(_suspense_panel, "Delete Pack", delete_texture_pack)
    mod.html.button(_suspense_panel, "Apply Pack", apply_texture_pack)
    
    mod.html.label(_suspense_panel, "Gamemode")
    current_gm = mod.player.get_gm()
    gm_names = {0: "Cube", 1: "Ship", 2: "Ball", 3: "Wave", 4: "UFO", 5: "Spider", 6: "Robot", 7: "Bird"}
    gm_name = gm_names.get(current_gm, f"Unknown ({current_gm})")
    mod.html.label(_suspense_panel, f"Current: {gm_name}")
    mod.html.button(_suspense_panel, "Cube", lambda: mod.player.setgm(0))
    mod.html.button(_suspense_panel, "Ship", lambda: mod.player.setgm(1))
    mod.html.button(_suspense_panel, "Ball", lambda: mod.player.setgm(2))
    mod.html.button(_suspense_panel, "Wave", lambda: mod.player.setgm(3))
    mod.html.button(_suspense_panel, "UFO", lambda: mod.player.setgm(4))
    mod.html.button(_suspense_panel, "Spider", lambda: mod.player.setgm(5))
    mod.html.button(_suspense_panel, "Robot", lambda: mod.player.setgm(6))
    mod.html.button(_suspense_panel, "Bird", lambda: mod.player.setgm(7))
    mod.html.button(_suspense_panel, "Close", close_suspense_menu)

def toggle_noclip():
    _suspense_state["noclip"] = not _suspense_state["noclip"]
    mod.js.run(f"window.noClip = {str(_suspense_state['noclip']).lower()}")
    refresh_suspense_menu()

def toggle_hitboxes():
    _suspense_state["hitboxes"] = not _suspense_state["hitboxes"]
    mod.js.run(f"window.showHitboxes = {str(_suspense_state['hitboxes']).lower()}")
    refresh_suspense_menu()

def toggle_hitboxtrail():
    _suspense_state["hitboxtrail"] = not _suspense_state["hitboxtrail"]
    mod.js.run(f"window.showHitboxTrail = {str(_suspense_state['hitboxtrail']).lower()}")
    refresh_suspense_menu()

def toggle_practice():
    _suspense_state["practice"] = not _suspense_state["practice"]
    mod.js.run("""
if (window._practicedMode) {
    window._practicedMode.togglePracticeMode();
}
""")
    refresh_suspense_menu()

def toggle_infinite_jump():
    _suspense_state["infinite_jump"] = not _suspense_state["infinite_jump"]
    refresh_suspense_menu()

def toggle_kill_on_touch():
    _suspense_state["kill_on_touch"] = not _suspense_state["kill_on_touch"]
    refresh_suspense_menu()

def toggle_platformer():
    _suspense_state["platformer"] = not _suspense_state["platformer"]
    refresh_suspense_menu()

def toggle_trajectory():
    _suspense_state["trajectory"] = not _suspense_state["trajectory"]
    refresh_suspense_menu()

def toggle_swap_texture():
    _suspense_state["swap_texture"] = not _suspense_state["swap_texture"]
    refresh_suspense_menu()

def swap_texture_key(value):
    global _swap_texture_key
    _swap_texture_key = value

def swap_texture_url(value):
    global _swap_texture_url
    _swap_texture_url = value
    if not _swap_texture_key or not _swap_texture_url:
        return
    mod.js.run(f"""
    (async () => {{
        try {{
            const response = await fetch('{_swap_texture_url}');
            const blob = await response.blob();
            const imageBitmap = await createImageBitmap(blob);
            const scene = window._gameScene || window.scene;
            if (!scene) return;
            const key = '{_swap_texture_key}';
            if (scene.textures.exists(key)) {{
                scene.textures.remove(key);
            }}
            const canvas = scene.textures.createCanvas(key, imageBitmap.width, imageBitmap.height);
            const ctx = canvas.getContext();
            ctx.drawImage(imageBitmap, 0, 0);
            scene.textures.addCanvas(key, canvas);
        }} catch (e) {{
            console.error('Failed to swap texture:', e);
        }}
    }})();
    """)

def upload_texture_file():
    global _swap_texture_key
    if not _swap_texture_key:
        return
    mod.js.run(f"""
    (async () => {{
        const key = '{_swap_texture_key}';
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e) => {{
            const file = e.target.files[0];
            if (!file) return;
            const blob = file;
            const imageBitmap = await createImageBitmap(blob);
            const scene = window._gameScene || window.scene;
            if (!scene) return;
            if (scene.textures.exists(key)) {{
                scene.textures.remove(key);
            }}
            const canvas = scene.textures.createCanvas(key, imageBitmap.width, imageBitmap.height);
            const ctx = canvas.getContext();
            ctx.drawImage(imageBitmap, 0, 0);
            scene.textures.addCanvas(key, canvas);
        }};
        input.click();
    }})();
    """)

def toggle_swap_sound():
    _suspense_state["swap_sound"] = not _suspense_state["swap_sound"]
    refresh_suspense_menu()

def swap_sound_key(value):
    global _swap_sound_key
    _swap_sound_key = value

def swap_sound_url(value):
    global _swap_sound_url
    _swap_sound_url = value
    if not _swap_sound_key or not _swap_sound_url:
        return
    mod.js.run(f"""
    (async () => {{
        try {{
            const response = await fetch('{_swap_sound_url}');
            const arrayBuffer = await response.arrayBuffer();
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            const scene = window._gameScene || window.scene;
            if (!scene) return;
            const key = '{_swap_sound_key}';
            if (scene.cache.audio.exists(key)) {{
                scene.cache.audio.remove(key);
            }}
            scene.cache.audio.add(key, audioBuffer);
        }} catch (e) {{
            console.error('Failed to swap sound:', e);
        }}
    }})();
    """)

def upload_sound_file():
    global _swap_sound_key
    if not _swap_sound_key:
        return
    mod.js.run(f"""
    (async () => {{
        const key = '{_swap_sound_key}';
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'audio/*';
        input.onchange = async (e) => {{
            const file = e.target.files[0];
            if (!file) return;
            const arrayBuffer = await file.arrayBuffer();
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            const scene = window._gameScene || window.scene;
            if (!scene) return;
            if (scene.cache.audio.exists(key)) {{
                scene.cache.audio.remove(key);
            }}
            scene.cache.audio.add(key, audioBuffer);
        }};
        input.click();
    }})();
    """)

def list_texture_packs():
    packs = _list_packs()
    active = _get_active_pack()
    lines = ["Texture Packs:", "  0. None (Default)"]
    for i, pack in enumerate(packs):
        name = pack.get("name", pack.get("file", "Unknown"))
        author = pack.get("author", "Unknown")
        status = " (ACTIVE)" if pack.get("name") == active else ""
        lines.append(f"  {i + 1}. {name} by {author}{status}")
    lines.append(f"\nActive: {active or 'None (Default)'}")
    alert("\n".join(lines))

def add_texture_pack():
    mod.texture.trigger_upload()

def delete_texture_pack():
    packs = _list_packs()
    if not packs:
        alert("No texture packs to delete")
        return
    lines = ["Select pack to delete:", "  0. Cancel"]
    for i, pack in enumerate(packs):
        name = pack.get("name", pack.get("file", "Unknown"))
        lines.append(f"  {i + 1}. {name}")
    alert("\n".join(lines))

def apply_texture_pack():
    packs = _list_packs()
    active = _get_active_pack()
    lines = ["Select pack to apply:", "  0. None (Default)"]
    for i, pack in enumerate(packs):
        name = pack.get("name", pack.get("file", "Unknown"))
        status = " (ACTIVE)" if pack.get("name") == active else ""
        lines.append(f"  {i + 1}. {name}{status}")
    alert("\n".join(lines))

def toggle_speedhack():
    _suspense_state["speedhack"] = not _suspense_state["speedhack"]
    if _suspense_state["speedhack"]:
        mod.js.run(f"window.speedHack = {_suspense_state['speedhack_value']}")
    else:
        mod.js.run("window.speedHack = 1")
    refresh_suspense_menu()

def set_speedhack_value(value):
    try:
        val = float(value)
        if val < 0.1:
            val = 0.1
        _suspense_state["speedhack_value"] = val
        if _suspense_state["speedhack"]:
            mod.js.run(f"window.speedHack = {val}")
        refresh_suspense_menu()
    except ValueError:
        pass

def toggle_auto_jump():
    _suspense_state["auto_jump"] = not _suspense_state["auto_jump"]
    refresh_suspense_menu()

def toggle_auto_play():
    _suspense_state["auto_play"] = not _suspense_state["auto_play"]
    refresh_suspense_menu()

def toggle_macro_bot():
    _suspense_state["macro_bot"] = not _suspense_state["macro_bot"]
    mod.js.run(f"window.macroBot = {str(_suspense_state['macro_bot']).lower()}")
    refresh_suspense_menu()

def cycle_size():
    sizes = [0.5, 1.0, 1.5, 2.0]
    current = _suspense_state["size"]
    idx = sizes.index(current) if current in sizes else 1
    idx = (idx + 1) % len(sizes)
    _suspense_state["size"] = sizes[idx]
    mod.js.run(f"""
if (window._player && window._player.p) {{
    window._player.p.isMini = {str(sizes[idx] < 1.0).lower()};
}}
""")
    refresh_suspense_menu()

def cycle_gravity():
    gravities = [0.5, 1.0, 1.5, 2.0, 3.0]
    current = _suspense_state["gravity"]
    idx = gravities.index(current) if current in gravities else 1
    idx = (idx + 1) % len(gravities)
    _suspense_state["gravity"] = gravities[idx]
    mod.js.run(f"""
if (window._player && window._player.p) {{
    window._player.p.gravity = {gravities[idx]};
}}
""")
    refresh_suspense_menu()

def apply_hacks():
    p = mod.js.run("""
if (window._player && window._player.p) {
    return window._player.p;
}
return null;
""")
    if p is None:
        return
    
    if _suspense_state["infinite_jump"]:
        mod.js.run("""
if (window._player && window._player.p) {
    window._player.p.canJump = true;
    window._player.p._jumpBufferTimer = 0;
    if (window._player.p.yVelocity > 0) {
        window._player.p.yVelocity = 0;
    }
}
""")
    
    if _suspense_state["fly"]:
        mod.player.setgm(2)
    
    if _suspense_state["auto_jump"]:
        if mod.input.key_down("space"):
            mod.js.run("""
if (window._player && window._player.p && window._player.p.onGround) {
    window._player.p.upKeyDown = true;
}
""")
    
    if _suspense_state["auto_play"]:
        mod.js.run("""
if (window._player && window._player.p) {
    window._player.p.upKeyDown = true;
}
""")
    
    if _suspense_state["kill_on_touch"]:
        mod.js.run("""
if (window._player && window._player.p && window._player.p.collideTop !== 0) {
    window._player.killPlayer();
}
""")

