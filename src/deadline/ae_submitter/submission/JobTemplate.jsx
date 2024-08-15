var OPENJD_TEMPLATE = {
    "specificationVersion": "jobtemplate-2023-09",
    "name": "After Effects Template Edit Test",
    "description": null,
    "parameterDefinitions": [{
            "name": "AfterEffectsProjectFile",
            "type": "PATH",
            "objectType": "FILE",
            "dataFlow": "IN",
            "userInterface": {
                "control": "CHOOSE_INPUT_FILE",
                "label": "After Effects Project File",
                "groupLabel": "After Effects Settings",
                "fileFilters": [{
                        "label": "After Effects Project Files",
                        "patterns": [
                            "*.aep",
                            "*.aepx"
                        ]
                    },
                    {
                        "label": "All Files",
                        "patterns": [
                            "*"
                        ]
                    }
                ]
            },
            "description": "The After Effects Project file to render."
        },
        {
            "name": "Frames",
            "type": "STRING",
            "userInterface": {
                "control": "LINE_EDIT",
                "label": "Frames",
                "groupLabel": "After Effects Settings"
            },
            "description": "The frame range to render. E.g. 1,8,11",
            "minLength": 1
        },
        {
            "name": "OutputPattern",
            "type": "STRING",
            "description": "Name for the output file.",
            "default": "Output_[####]"
        },
        {
            "name": "OutputFormat",
            "type": "STRING",
            "description": "File type.",
            "default": "png"
        },
        {
            "name": "CompName",
            "type": "STRING",
            "description": "Selected composition to render."
        },
        {
            "name": "OutputFilePath",
            "type": "PATH",
            "objectType": "DIRECTORY",
            "dataFlow": "OUT",
            "userInterface": {
                "control": "CHOOSE_DIRECTORY",
                "label": "Output File Path",
                "groupLabel": "After Effects Settings"
            },
            "description": "The render output path."
        }
    ],
    "steps": [{
        "name": "AfterEffects Simple Render",
        "parameterSpace": {
            "taskParameterDefinitions": [
                {
                    "name": "Frame",
                    "type": "INT",
                    "range": "{{Param.Frames}}"
                },
                {
                    "name": "Comp",
                    "type": "STRING",
                    "range": ["{{Param.CompName}}"]
                }
            ]
        },
        "stepEnvironments": [{
            "name": "Install Fonts",
            "description": "Installs and uninstall fonts",
            "script": {
                "embeddedFiles": [
                    {
                        "name": "initData",
                        "filename": "init-data.yaml",
                        "type": "TEXT",
                        "data": "project_file: {{Param.AfterEffectsProjectFile}} \n"
                    },
                    {
                        "name": "runStart",
                        "filename": "start.bat",
                        "type": "TEXT",
                        "data": "afterfx-openjd daemon start --connection-file {{Session.WorkingDirectory}}/connection.json --init-data file://{{Env.File.initData}} \n"
                    },
                    {
                        "name": "runStop",
                        "filename": "stop.bat",
                        "type": "TEXT",
                        "data": "afterfx-openjd daemon stop --connection-file {{Session.WorkingDirectory}}/connection.json \n"
                    },
                    {
                        "name": "font_installer",
                        "filename": "font_installer.py",
                        "type": "TEXT",
                        "data": "import argparse\nimport os\nimport shutil\nimport ctypes\nfrom ctypes import wintypes\n\ntry:\n    import winreg\nexcept ImportError:\n    import _winreg as winreg\n\nuser32 = ctypes.WinDLL('user32', use_last_error=True)\ngdi32 = ctypes.WinDLL('gdi32', use_last_error=True)\n\nFONTS_REG_PATH = r'Software\\Microsoft\\Windows NT\\CurrentVersion\\Fonts'\n\nHWND_BROADCAST = 0xFFFF\nSMTO_ABORTIFHUNG = 0x0002\nWM_FONTCHANGE = 0x001D\nGFRI_DESCRIPTION = 1\nGFRI_ISTRUETYPE = 3\n\nINSTALL_SCOPE_USER = 'USER'\nINSTALL_SCOPE_SYSTEM = 'SYSTEM'\n\nFONT_LOCATION_SYSTEM = os.path.join(os.environ.get('SystemRoot'), 'Fonts')\nFONT_LOCATION_USER = os.path.join(os.environ.get('LocalAppData'), 'Microsoft', 'Windows', 'Fonts')\n\nFONT_EXTENSIONS = {'.OTF', 'TTF'}\n\n# Check if the Fonts folder exists, create it if it doesn't\nif not os.path.exists(FONT_LOCATION_USER):\n    print('Creating User Fonts folder: %s' % FONT_LOCATION_USER)\n    os.makedirs(FONT_LOCATION_USER)\n\ndef install_font(src_path, scope=INSTALL_SCOPE_USER):\n    try:\n        # copy the font to the Windows Fonts folder\n        if scope == INSTALL_SCOPE_SYSTEM:\n            dst_path = os.path.join(FONT_LOCATION_SYSTEM, os.path.basename(src_path))\n            registry_scope = winreg.HKEY_LOCAL_MACHINE\n        else:\n            dst_path = os.path.join(FONT_LOCATION_USER, os.path.basename(src_path))\n            registry_scope = winreg.HKEY_CURRENT_USER\n\n        shutil.copy(src_path, dst_path)\n        # load the font in the current session\n        if not gdi32.AddFontResourceW(dst_path):\n            os.remove(dst_path)\n            raise Exception('AddFontResource failed to load \\'%s\\'' % src_path)\n        # notify running programs\n        user32.SendMessageTimeoutW(\n            HWND_BROADCAST, WM_FONTCHANGE, 0, 0, SMTO_ABORTIFHUNG, 1000, None\n        )\n        # store the fontname/filename in the registry\n        filename = os.path.basename(dst_path)\n        fontname = os.path.splitext(filename)[0]\n        # try to get the font's real name\n        cb = wintypes.DWORD()\n        if gdi32.GetFontResourceInfoW(filename, ctypes.byref(cb), None, GFRI_DESCRIPTION):\n            buf = (ctypes.c_wchar * cb.value)()\n            if gdi32.GetFontResourceInfoW(filename, ctypes.byref(cb), buf, GFRI_DESCRIPTION):\n                fontname = buf.value\n        is_truetype = wintypes.BOOL()\n        cb.value = ctypes.sizeof(is_truetype)\n        gdi32.GetFontResourceInfoW(\n            filename, ctypes.byref(cb), ctypes.byref(is_truetype), GFRI_ISTRUETYPE\n        )\n        if is_truetype:\n            fontname += ' (TrueType)'\n        with winreg.OpenKey(registry_scope, FONTS_REG_PATH, 0, winreg.KEY_SET_VALUE) as key:\n            winreg.SetValueEx(key, fontname, 0, winreg.REG_SZ, filename)\n    except Exception:\n        import traceback\n\n        return False, traceback.format_exc()\n    return True, ''\n\n\ndef uninstall_font(src_path, scope=INSTALL_SCOPE_USER):\n    try:\n        # copy the font to the Windows Fonts folder\n        if scope == INSTALL_SCOPE_SYSTEM:\n            dst_path = os.path.join(FONT_LOCATION_SYSTEM, os.path.basename(src_path))\n            registry_scope = winreg.HKEY_LOCAL_MACHINE\n        else:\n            dst_path = os.path.join(FONT_LOCATION_USER, os.path.basename(src_path))\n            registry_scope = winreg.HKEY_CURRENT_USER\n\n        # remove the fontname/filename from the registry\n        filename = os.path.basename(dst_path)\n        fontname = os.path.splitext(filename)[0]\n        # try to get the font's real name\n        cb = wintypes.DWORD()\n        if gdi32.GetFontResourceInfoW(filename, ctypes.byref(cb), None, GFRI_DESCRIPTION):\n            buf = (ctypes.c_wchar * cb.value)()\n            if gdi32.GetFontResourceInfoW(filename, ctypes.byref(cb), buf, GFRI_DESCRIPTION):\n                fontname = buf.value\n        is_truetype = wintypes.BOOL()\n        cb.value = ctypes.sizeof(is_truetype)\n        gdi32.GetFontResourceInfoW(\n            filename, ctypes.byref(cb), ctypes.byref(is_truetype), GFRI_ISTRUETYPE\n        )\n        if is_truetype:\n            fontname += ' (TrueType)'\n\n        with winreg.OpenKey(registry_scope, FONTS_REG_PATH, 0, winreg.KEY_SET_VALUE) as key:\n            winreg.DeleteValue(key, fontname)\n\n        # unload the font in the current session\n        if not gdi32.RemoveFontResourceW(dst_path):\n            os.remove(dst_path)\n            raise Exception('RemoveFontResourceW failed to load \\'%s\\'' % src_path)\n\n        if os.path.exists(dst_path):\n            os.remove(dst_path)\n\n        # notify running programs\n        user32.SendMessageTimeoutW(\n            HWND_BROADCAST, WM_FONTCHANGE, 0, 0, SMTO_ABORTIFHUNG, 1000, None\n        )\n    except Exception:\n        import traceback\n\n        return False, traceback.format_exc()\n    return True, ''\n\ndef _find_fonts(folder):\n    fonts = set()\n    for path in os.listdir(folder):\n        print('path: ' + path)\n        if path.startswith('assetroot-'):\n            asset_dir = os.path.join(folder, path)\n            print('  asset_dir: ' + asset_dir)\n            for asset_path in os.listdir(asset_dir):\n                print('    asset_path: ' + asset_path)\n                _, ext = os.path.splitext(os.path.join(asset_dir, asset_path))\n                if ext.upper() in FONT_EXTENSIONS:\n                    fonts.add(os.path.join(asset_dir, asset_path))\n    return fonts\n\ndef _install_fonts(folder):\n    fonts = _find_fonts(folder)\n    installed_fonts = set()\n    if not fonts:\n        print('No fonts to install')\n        return\n\n    for font in fonts:\n        print('Installing font: %s' % font)\n        installed, msg = install_font(font)\n        if not installed:\n            print('    Error installing font: %s' % msg)\n        else:\n            installed_fonts.add(font)\n    return installed_fonts\n\ndef _remove_fonts(folder):\n    fonts = _find_fonts()\n    if not fonts:\n        print('No fonts to uninstall')\n        return\n\n    for font in fonts:\n        print('Uninstalling font: %s' % font)\n        uninstalled, msg = uninstall_font(font)\n        if not uninstalled:\n            print('    Error uninstalling font: %s' % msg)\n\nif __name__ == '__main__':\n    parser = argparse.ArgumentParser(\n    prog='InstallFonts',\n    description='Installs and uninstalls fonts for After Effects')\n\n    group = parser.add_mutually_exclusive_group(required=True)\n    group.add_argument('-i', '--install', metavar='FOLDER_PATH', help='Install font located in FOLDER_PATH')\n    group.add_argument('-un', '--uninstall', metavar='FOLDER_PATH', help='Remove fonts located in FOLDER_PATH')\n\n    args = parser.parse_args()\n    if args.install:\n        _install_fonts(args.install)\n    elif args.uninstall:\n        _remove_fonts(args.uninstall)\n    else:\n        raise RuntimeError('Argparse forces you to specify install or uninstall')\n    \n    print('Done running font installer')"
                    }
                ],
                "actions": {
                    "onEnter": {
                        "command": "python",
                        "args": [
                            "{{Env.File.font_installer}}",
                            "--install",
                            "{{Session.WorkingDirectory}}"
                        ]
                    },
                    "onExit": {
                        "command": "python",
                        "args": [
                            "{{Env.File.font_installer}}",
                            "--uninstall",
                            "{{Session.WorkingDirectory}}"
                        ]
                    }
                }
            }
        }],
        "script": {
            "actions": {
                "onRun": {
                    "command": "powershell",
                    "args": [
                        "{{Task.File.runAerender}}"
                    ]
                }
            },
            "embeddedFiles": [
            {
                "name": "runData",
                "filename": "run-data.yaml",
                "type": "TEXT",
                "data": [
                    "frame: {{Task.Param.Frame}}"
                ]
            },
            {
                "name": "runScript",
                "filename": "bootstrap.bat",
                "type": "TEXT",
                "runnable": true,
                "data": "afterfx-openjd daemon run --connection-file {{ Session.WorkingDirectory }}/connection.json --run-data file://{{Task.File.runData}} \n"
            },
            {
                "name": "runAerender",
                "filename": "aerender.bat",
                "type": "TEXT",
                "runnable": true,
                "data": "\"%AFTEREFFECTS_ADAPTOR_AERENDER_EXECUTABLE%\" -project \"{{Param.AfterEffectsProjectFile}}\" -comp \"{{Task.Param.Comp}}\" -s {{Task.Param.Frame}} -e {{Task.Param.Frame}} \n"
            }
            ]
        }
    }]
}
