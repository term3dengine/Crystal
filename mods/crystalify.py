from crystal import Crystal
import time


mod = Crystal()

_manager_panel = None
_menu_button_container = None

@mod.onstart("loading")
def loading():
    mod.loading.set_tip("Loading Crystalify...")

@mod.onstart("menu")
def startMenu():
    global _menu_button_container
    mod.log("Crystalify loaded!")
    _menu_button_container = mod.ui.container(400, 300)
    #mod.ui.image_button(_menu_button_container, 0, -80, "CR_modManager", open_mod_manager, width=128, height=64)
    mod.ui.on_uploaded(on_mod_uploaded)

@mod.update("menu")
async def menuUpdate():
    if mod.input.key_pressed("q"):
        if _manager_panel is None:
            open_mod_manager()
        else:
            close_manager()

def on_mod_uploaded(filename):
    mod.log(f"Uploaded: {filename}")
    if _manager_panel is not None:
        refresh_mod_list()

def open_mod_manager():
    global _manager_panel
    if _manager_panel is not None:
        mod.html.destroy(_manager_panel)
    _manager_panel = mod.html.panel(100, 100, 400, 300, "Mod Manager")
    refresh_mod_list()

def refresh_mod_list():
    global _manager_panel
    if _manager_panel is None:
        return
    mod.html.destroy(_manager_panel)
    _manager_panel = mod.html.panel(100, 100, 400, 300, "Mod Manager")
    saved = mod.storage.list()
    if not saved:
        mod.html.label(_manager_panel, "No saved mods")
    else:
        for name in saved:
            mod.html.label(_manager_panel, name)
            mod.html.button(_manager_panel, f"Run {name}", lambda n=name: run_mod(n))
            mod.html.button(_manager_panel, f"Delete {name}", lambda n=name: delete_mod(n))
    mod.html.button(_manager_panel, "Upload .py", upload_mod)
    mod.html.button(_manager_panel, "Close", close_manager)

def run_mod(name):
    mod.log(f"Running mod: {name}")
    mod.storage.run(name)
    refresh_mod_list()

def delete_mod(name):
    mod.log(f"Deleting mod: {name}")
    mod.storage.delete(name)
    refresh_mod_list()

def close_manager():
    global _manager_panel
    if _manager_panel is not None:
        mod.html.destroy(_manager_panel)
        _manager_panel = None

def upload_mod():
    mod.log("Opening file picker...")
    mod.ui.trigger_upload()
