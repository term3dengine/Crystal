class PlayerProxy:
    def __init__(self, mod):
        self._mod = mod

    def collision(self):
        return self._mod._js_call("player.collision")

    def alive(self, value=None):
        return self._mod._js_call("player.alive", value)

    def get_gm(self):
        return self._mod._js_call("player.get_gm")

    def setgm(self, mode):
        return self._mod._js_call("player.set_gm", mode)

    def get_x(self):
        return self._mod._js_call("player.get_x")

    def set_x(self, value):
        return self._mod._js_call("player.set_x", value)

    def get_y(self):
        return self._mod._js_call("player.get_y")

    def set_y(self, value):
        return self._mod._js_call("player.set_y", value)

    def get_speed(self):
        return self._mod._js_call("player.get_speed")

    def set_speed(self, value):
        return self._mod._js_call("player.set_speed", value)

    def set_direction(self, direction):
        return self._mod._js_call("player.set_direction", direction)

    def freefly(self, enabled):
        return self._mod._js_call("player.freefly", enabled)


class GameProxy:
    def __init__(self, mod):
        self._mod = mod

    def set_var(self, name, value):
        return self._mod._js_call("game.set_var", name, value)

    def get_var(self, name):
        return self._mod._js_call("game.get_var", name)

    def set_color_channel(self, channel_id, r, g, b):
        return self._mod._js_call("game.set_color_channel", channel_id, r, g, b)

    def get_color_channel(self, channel_id):
        return self._mod._js_call("game.get_color_channel", channel_id)

    @property
    def level_name(self):
        return self._mod._js_call("game.level_name")

    @level_name.setter
    def level_name(self, value):
        self._mod._js_call("game.set_level_name", value)

    @property
    def level_id(self):
        return self._mod._js_call("game.level_id")

    @level_id.setter
    def level_id(self, value):
        self._mod._js_call("game.set_level_id", value)

    @property
    def song_id(self):
        return self._mod._js_call("game.song_id")

    @song_id.setter
    def song_id(self, value):
        self._mod._js_call("game.set_song_id", value)

    @property
    def song_name(self):
        return self._mod._js_call("game.song_name")

    @property
    def current_menu(self):
        return self._mod._js_call("game.current_menu")

    def open_menu(self, menu_name):
        return self._mod._js_call("game.open_menu", menu_name)

    def return_to_menu(self):
        return self._mod._js_call("game.return_to_menu")


class InputProxy:
    def __init__(self, mod):
        self._mod = mod

    def key_down(self, key):
        return self._mod._js_call("input.key_down", key)

    def key_pressed(self, key):
        return self._mod._js_call("input.key_pressed", key)

    def mouse_x(self):
        return self._mod._js_call("input.mouse_x")

    def mouse_y(self):
        return self._mod._js_call("input.mouse_y")

    def mouse_down(self):
        return self._mod._js_call("input.mouse_down")


class JSProxy:
    def __init__(self, mod):
        self._mod = mod

    def run(self, code):
        return self._mod._js_call("js.run", code)


class LoadingProxy:
    def __init__(self, mod):
        self._mod = mod

    def set_tip(self, text):
        return self._mod._js_call("loading.set_tip", text)

    def show(self):
        return self._mod._js_call("loading.show")

    def hide(self):
        return self._mod._js_call("loading.hide")


class TextProxy:
    def __init__(self, mod):
        self._mod = mod

    def add(self, scene, x, y, text, font="bigFont", size=30, color="#ffffff"):
        return self._mod._js_call("text.add", scene, x, y, text, font, size, color)

    def remove(self, text_id):
        return self._mod._js_call("text.remove", text_id)

    def update(self, text_id, new_text):
        return self._mod._js_call("text.update", text_id, new_text)


class UIProxy:
    def __init__(self, mod):
        self._mod = mod

    def container(self, x, y):
        return self._mod._js_call("ui.container", x, y)

    def destroy(self, container_id):
        return self._mod._js_call("ui.destroy", container_id)

    def button(self, container_id, x, y, text, callback):
        if callback not in _ui_callbacks:
            _ui_callbacks[callback] = len(_ui_callbacks)
            _ui_callbacks_list.append(callback)
        callback_id = _ui_callbacks[callback]
        return self._mod._js_call("ui.button", container_id, x, y, text, callback_id)

    def text(self, container_id, x, y, text, font="bigFont", size=30, color="#ffffff"):
        return self._mod._js_call("ui.text", container_id, x, y, text, font, size, color)

    def visible(self, container_id, visible):
        return self._mod._js_call("ui.visible", container_id, visible)

    def on_uploaded(self, callback):
        if callback not in _ui_callbacks:
            _ui_callbacks[callback] = len(_ui_callbacks)
            _ui_callbacks_list.append(callback)
        callback_id = _ui_callbacks[callback]
        return self._mod._js_call("ui.on_uploaded", callback_id)

    def trigger_upload(self):
        return self._mod._js_call("ui.trigger_upload")

    def image_button(self, container_id, x, y, texture, callback, width=None, height=None):
        if callback not in _ui_callbacks:
            _ui_callbacks[callback] = len(_ui_callbacks)
            _ui_callbacks_list.append(callback)
        callback_id = _ui_callbacks[callback]
        return self._mod._js_call("ui.image_button", container_id, x, y, texture, callback_id, width, height)


class HTMLProxy:
    def __init__(self, mod):
        self._mod = mod

    def panel(self, x, y, width, height, title=""):
        return self._mod._js_call("html.panel", x, y, width, height, title)

    def button(self, panel_id, text, callback):
        if callback not in _html_callbacks:
            _html_callbacks[callback] = len(_html_callbacks)
            _html_callbacks_list.append(callback)
        callback_id = _html_callbacks[callback]
        return self._mod._js_call("html.button", panel_id, text, callback_id)

    def label(self, panel_id, text):
        return self._mod._js_call("html.label", panel_id, text)

    def input(self, panel_id, placeholder, callback):
        if callback not in _html_callbacks:
            _html_callbacks[callback] = len(_html_callbacks)
            _html_callbacks_list.append(callback)
        callback_id = _html_callbacks[callback]
        return self._mod._js_call("html.input", panel_id, placeholder, callback_id)

    def destroy(self, panel_id):
        return self._mod._js_call("html.destroy", panel_id)

    def show(self, panel_id):
        return self._mod._js_call("html.show", panel_id)

    def hide(self, panel_id):
        return self._mod._js_call("html.hide", panel_id)


_ui_callbacks = {}
_ui_callbacks_list = []
_html_callbacks = {}
_html_callbacks_list = []

def _get_ui_callback(callback_id):
    if 0 <= callback_id < len(_ui_callbacks_list):
        return _ui_callbacks_list[callback_id]
    return None

def _get_html_callback(callback_id):
    if 0 <= callback_id < len(_html_callbacks_list):
        return _html_callbacks_list[callback_id]
    return None

def _get_ui_callback(callback_id):
    if 0 <= callback_id < len(_ui_callbacks_list):
        return _ui_callbacks_list[callback_id]
    return None


class TextureProxy:
    def __init__(self, mod):
        self._mod = mod

    def list_packs(self):
        return self._mod._js_call("texture.list_packs")

    def add_pack(self, file_data):
        return self._mod._js_call("texture.add_pack", file_data)

    def delete_pack(self, pack_name):
        return self._mod._js_call("texture.delete_pack", pack_name)

    def apply_pack(self, pack_name):
        return self._mod._js_call("texture.apply_pack", pack_name)

    def get_active(self):
        return self._mod._js_call("texture.get_active")

    def get_info(self, pack_name):
        return self._mod._js_call("texture.get_info", pack_name)

    def trigger_upload(self):
        return self._mod._js_call("texture.trigger_upload")


class StorageProxy:
    def __init__(self, mod):
        self._mod = mod

    def save(self, name, code):
        return self._mod._js_call("storage.save", name, code)

    def list(self):
        return self._mod._js_call("storage.list")

    def delete(self, name):
        return self._mod._js_call("storage.delete", name)

    def load(self, name):
        return self._mod._js_call("storage.load", name)

    def run(self, name):
        return self._mod._js_call("storage.run", name)


class Crystal:
    def __init__(self):
        self._start_handlers = {}
        self._update_handlers = {}
        self._js_bridge = None
        self.log_func = None
        self.player = PlayerProxy(self)
        self.game = GameProxy(self)
        self.input = InputProxy(self)
        self.js = JSProxy(self)
        self.loading = LoadingProxy(self)
        self.text = TextProxy(self)
        self.ui = UIProxy(self)
        self.html = HTMLProxy(self)
        self.texture = TextureProxy(self)
        self.storage = StorageProxy(self)

    def _set_bridge(self, js_bridge):
        self._js_bridge = js_bridge
        self.log_func = js_bridge.log

    def _js_call(self, method, *args):
        if self._js_bridge and hasattr(self._js_bridge, 'call'):
            return self._js_bridge.call(method, *args)
        try:
            import js
            bridge = js._mod_bridge
            if hasattr(bridge, 'call'):
                return bridge.call(method, *args)
        except Exception:
            pass
        return None

    def log(self, msg):
        if self.log_func:
            self.log_func(msg)

    def onstart(self, scene):
        def decorator(func):
            self._start_handlers.setdefault(scene, []).append(func)
            return func
        return decorator

    def update(self, scene):
        def decorator(func):
            self._update_handlers.setdefault(scene, []).append(func)
            return func
        return decorator
