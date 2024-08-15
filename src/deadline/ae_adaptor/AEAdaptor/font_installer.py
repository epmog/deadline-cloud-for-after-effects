import argparse
import os
import shutil
import ctypes
from ctypes import wintypes

try:
    import winreg
except ImportError:
    import _winreg as winreg

user32 = ctypes.WinDLL('user32', use_last_error=True)
gdi32 = ctypes.WinDLL('gdi32', use_last_error=True)

FONTS_REG_PATH = r'Software\Microsoft\Windows NT\CurrentVersion\Fonts'

HWND_BROADCAST = 0xFFFF
SMTO_ABORTIFHUNG = 0x0002
WM_FONTCHANGE = 0x001D
GFRI_DESCRIPTION = 1
GFRI_ISTRUETYPE = 3

INSTALL_SCOPE_USER = 'USER'
INSTALL_SCOPE_SYSTEM = 'SYSTEM'

FONT_LOCATION_SYSTEM = os.path.join(os.environ.get('SystemRoot'), 'Fonts')
FONT_LOCATION_USER = os.path.join(os.environ.get('LocalAppData'), 'Microsoft', 'Windows', 'Fonts')

FONT_EXTENSIONS = {'.OTF', 'TTF'}

# Check if the Fonts folder exists, create it if it doesn't
if not os.path.exists(FONT_LOCATION_USER):
    print('Creating User Fonts folder: %s' % FONT_LOCATION_USER)
    os.makedirs(FONT_LOCATION_USER)

def install_font(src_path, scope=INSTALL_SCOPE_USER):
    try:
        # copy the font to the Windows Fonts folder
        if scope == INSTALL_SCOPE_SYSTEM:
            dst_path = os.path.join(FONT_LOCATION_SYSTEM, os.path.basename(src_path))
            registry_scope = winreg.HKEY_LOCAL_MACHINE
        else:
            dst_path = os.path.join(FONT_LOCATION_USER, os.path.basename(src_path))
            registry_scope = winreg.HKEY_CURRENT_USER

        shutil.copy(src_path, dst_path)
        # load the font in the current session
        if not gdi32.AddFontResourceW(dst_path):
            os.remove(dst_path)
            raise Exception('AddFontResource failed to load \'%s\'' % src_path)
        # notify running programs
        user32.SendMessageTimeoutW(
            HWND_BROADCAST, WM_FONTCHANGE, 0, 0, SMTO_ABORTIFHUNG, 1000, None
        )
        # store the fontname/filename in the registry
        filename = os.path.basename(dst_path)
        fontname = os.path.splitext(filename)[0]
        # try to get the font's real name
        cb = wintypes.DWORD()
        if gdi32.GetFontResourceInfoW(filename, ctypes.byref(cb), None, GFRI_DESCRIPTION):
            buf = (ctypes.c_wchar * cb.value)()
            if gdi32.GetFontResourceInfoW(filename, ctypes.byref(cb), buf, GFRI_DESCRIPTION):
                fontname = buf.value
        is_truetype = wintypes.BOOL()
        cb.value = ctypes.sizeof(is_truetype)
        gdi32.GetFontResourceInfoW(
            filename, ctypes.byref(cb), ctypes.byref(is_truetype), GFRI_ISTRUETYPE
        )
        if is_truetype:
            fontname += ' (TrueType)'
        with winreg.OpenKey(registry_scope, FONTS_REG_PATH, 0, winreg.KEY_SET_VALUE) as key:
            winreg.SetValueEx(key, fontname, 0, winreg.REG_SZ, filename)
    except Exception:
        import traceback

        return False, traceback.format_exc()
    return True, ''


def uninstall_font(src_path, scope=INSTALL_SCOPE_USER):
    try:
        # copy the font to the Windows Fonts folder
        if scope == INSTALL_SCOPE_SYSTEM:
            dst_path = os.path.join(FONT_LOCATION_SYSTEM, os.path.basename(src_path))
            registry_scope = winreg.HKEY_LOCAL_MACHINE
        else:
            dst_path = os.path.join(FONT_LOCATION_USER, os.path.basename(src_path))
            registry_scope = winreg.HKEY_CURRENT_USER

        # remove the fontname/filename from the registry
        filename = os.path.basename(dst_path)
        fontname = os.path.splitext(filename)[0]
        # try to get the font's real name
        cb = wintypes.DWORD()
        if gdi32.GetFontResourceInfoW(filename, ctypes.byref(cb), None, GFRI_DESCRIPTION):
            buf = (ctypes.c_wchar * cb.value)()
            if gdi32.GetFontResourceInfoW(filename, ctypes.byref(cb), buf, GFRI_DESCRIPTION):
                fontname = buf.value
        is_truetype = wintypes.BOOL()
        cb.value = ctypes.sizeof(is_truetype)
        gdi32.GetFontResourceInfoW(
            filename, ctypes.byref(cb), ctypes.byref(is_truetype), GFRI_ISTRUETYPE
        )
        if is_truetype:
            fontname += ' (TrueType)'

        with winreg.OpenKey(registry_scope, FONTS_REG_PATH, 0, winreg.KEY_SET_VALUE) as key:
            winreg.DeleteValue(key, fontname)

        # unload the font in the current session
        if not gdi32.RemoveFontResourceW(dst_path):
            os.remove(dst_path)
            raise Exception('RemoveFontResourceW failed to load \'%s\'' % src_path)

        if os.path.exists(dst_path):
            os.remove(dst_path)

        # notify running programs
        user32.SendMessageTimeoutW(
            HWND_BROADCAST, WM_FONTCHANGE, 0, 0, SMTO_ABORTIFHUNG, 1000, None
        )
    except Exception:
        import traceback

        return False, traceback.format_exc()
    return True, ''

def _find_fonts(folder):
    fonts = set()
    for path in os.listdir(folder):
        print('path: ' + path)
        if path.startswith('assetroot-'):
            asset_dir = os.path.join(folder, path)
            print('  asset_dir: ' + asset_dir)
            for asset_path in os.listdir(asset_dir):
                print('    asset_path: ' + asset_path)
                _, ext = os.path.splitext(os.path.join(asset_dir, asset_path))
                if ext.upper() in FONT_EXTENSIONS:
                    fonts.add(os.path.join(asset_dir, asset_path))
    return fonts

def _install_fonts(folder):
    fonts = _find_fonts(folder)
    installed_fonts = set()
    if not fonts:
        print('No fonts to install')
        return

    for font in fonts:
        print('Installing font: %s' % font)
        installed, msg = install_font(font)
        if not installed:
            print('    Error installing font: %s' % msg)
        else:
            installed_fonts.add(font)
    return installed_fonts

def _remove_fonts(folder):
    fonts = _find_fonts(folder)
    if not fonts:
        print('No fonts to uninstall')
        return

    for font in fonts:
        print('Uninstalling font: %s' % font)
        uninstalled, msg = uninstall_font(font)
        if not uninstalled:
            print('    Error uninstalling font: %s' % msg)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(
    prog='InstallFonts',
    description='Installs and uninstalls fonts for After Effects')

    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('-i', '--install', metavar='FOLDER_PATH', help='Install font located in FOLDER_PATH')
    group.add_argument('-un', '--uninstall', metavar='FOLDER_PATH', help='Remove fonts located in FOLDER_PATH')

    args = parser.parse_args()
    if args.install:
        _install_fonts(args.install)
    elif args.uninstall:
        _remove_fonts(args.uninstall)
    else:
        raise RuntimeError('Argparse forces you to specify install or uninstall')
    
    print('Done running font installer')