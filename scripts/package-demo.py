"""Package the already-built demo deterministically for download."""
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo
import argparse
import json

demo = Path(__file__).resolve().parent.parent / "windows-demo"
parser = argparse.ArgumentParser()
parser.add_argument("--check", action="store_true")
parser.add_argument("--site-profile", type=Path)
parser.add_argument("--output", type=Path, default=demo / "Sig-Assist-Windows-Demo.zip")
args = parser.parse_args()
if args.site_profile and args.output.resolve().is_relative_to(demo.parent):
    parser.error("Write site-specific distributions outside the repository.")
files = ["Start-Sig-Assist.bat", "Start-Sig-Assist.cmd", "Start-Iguana-Connector.bat", "README.txt", "index.html", "iguana-bridge.mjs", "framework-desktop.mjs", "FrameworkDesktop.cs", "IGUANA-CONNECTOR.md", "FRAMEWORK-DESKTOP.md", "DOCUTRACK-EDC.md", "DESKTOP-RECOVERY-2026-10-04.md", "TRANSLATOR-2026-10-04.md", "TRANSLATOR-2026-11-09.md"]
sources = {
    "DOCUTRACK-EDC.md": demo.parent / "docs" / "DOCUTRACK-EDC.md",
    "TRANSLATOR-2026-11-09.md": demo.parent / "docs" / "TRANSLATOR-2026-11-09.md",
    "TRANSLATOR-2026-10-04.md": demo.parent / "docs" / "TRANSLATOR-2026-10-04.md",
    "Start-Sig-Assist.cmd": demo.parent / "windows" / "Start-Sig-Assist.cmd",
    "iguana-bridge.mjs": demo.parent / "scripts" / "iguana-bridge.mjs",
    "framework-desktop.mjs": demo.parent / "scripts" / "framework-desktop.mjs",
    "FrameworkDesktop.cs": demo.parent / "windows" / "FrameworkDesktop.cs",
    "FRAMEWORK-DESKTOP.md": demo.parent / "docs" / "FRAMEWORK-DESKTOP.md",
    "DESKTOP-RECOVERY-2026-10-04.md": demo.parent / "docs" / "DESKTOP-RECOVERY-2026-10-04.md",
    "IGUANA-CONNECTOR.md": demo.parent / "docs" / "IGUANA-CONNECTOR.md",
}
contents = {}
for name in files:
    source = sources.get(name, demo / name)
    data = source.read_bytes().replace(b"\r\n", b"\n")
    if name.endswith((".bat", ".cmd", ".ps1", ".txt")):
        data = data.replace(b"\n", b"\r\n")
    contents[name] = data
if args.site_profile:
    contents["iguana-site.json"] = args.site_profile.read_bytes()
    profile = json.loads(contents["iguana-site.json"])
    account = profile.get("fallbackCredentials") or {}
    if not all(isinstance(v, str) and v.strip() for v in (
        profile.get("serverUrl"), profile.get("channel"), account.get("username"), account.get("password")
    )):
        parser.error("A LAN profile requires serverUrl, channel and both fallbackCredentials fields.")
    # The technician's usual shortcut starts the live workstation; keep an offline option.
    contents["Open-Sig-Assist-Offline.bat"] = contents["Start-Sig-Assist.bat"]
    site_launcher = (demo.parent / "windows" / "Start-Sig-Assist-LAN.cmd").read_bytes().replace(b"\r\n", b"\n").replace(b"\n", b"\r\n")
    for name in ("Start-Sig-Assist.bat", "Start-Sig-Assist.cmd"):
        contents[name] = site_launcher
    contents["README.txt"] = (
        b"SIG-ASSIST LAN EDITION\r\n"
        b"Extract all files and double-click Start-Sig-Assist.bat. Use Find E-Rx normally; "
        b"access is checked automatically. No server login is needed.\r\n"
        b"For the offline demo instructions below, use Open-Sig-Assist-Offline.bat or index.html.\r\n\r\n"
        + contents["README.txt"]
    )
if args.check:
    with ZipFile(args.output) as archive:
        assert set(archive.namelist()) == set(contents), "Download contains unexpected or missing files"
        for name, data in contents.items():
            assert archive.read(name) == data, f"Rebuild the download: {name} differs from current source"
    print(f"Verified {args.output.name}: every archived file matches its source")
else:
    with ZipFile(args.output, "w", compression=ZIP_DEFLATED, compresslevel=9) as archive:
      for name, data in contents.items():
        entry = ZipInfo(name, date_time=(2026, 10, 1, 0, 0, 0))
        entry.compress_type = ZIP_DEFLATED
        entry.create_system = 0
        entry.external_attr = 0
        archive.writestr(entry, data, compresslevel=9)
    print(f"Packaged {args.output.name}")
