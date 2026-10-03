"""Package the already-built demo deterministically for download."""
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo
import sys

demo = Path(__file__).resolve().parent.parent / "windows-demo"
files = ["Start-Sig-Assist.bat", "Start-Sig-Assist.cmd", "Start-Iguana-Connector.bat", "README.txt", "index.html", "iguana-bridge.mjs", "framework-desktop.mjs", "FrameworkDesktop.cs", "IGUANA-CONNECTOR.md", "FRAMEWORK-DESKTOP.md"]
sources = {
    "Start-Sig-Assist.cmd": demo.parent / "windows" / "Start-Sig-Assist.cmd",
    "iguana-bridge.mjs": demo.parent / "scripts" / "iguana-bridge.mjs",
    "framework-desktop.mjs": demo.parent / "scripts" / "framework-desktop.mjs",
    "FrameworkDesktop.cs": demo.parent / "windows" / "FrameworkDesktop.cs",
    "FRAMEWORK-DESKTOP.md": demo.parent / "docs" / "FRAMEWORK-DESKTOP.md",
    "IGUANA-CONNECTOR.md": demo.parent / "docs" / "IGUANA-CONNECTOR.md",
}
contents = {}
for name in files:
    source = sources.get(name, demo / name)
    data = source.read_bytes().replace(b"\r\n", b"\n")
    if name.endswith((".bat", ".cmd", ".ps1", ".txt")):
        data = data.replace(b"\n", b"\r\n")
    contents[name] = data
if "--check" in sys.argv:
    with ZipFile(demo / "Sig-Assist-Windows-Demo.zip") as archive:
        assert set(archive.namelist()) == set(files), "Download contains unexpected or missing files"
        for name, data in contents.items():
            assert archive.read(name) == data, f"Rebuild the download: {name} differs from current source"
    print("Committed Windows download matches the current build and launch scripts")
else:
    with ZipFile(demo / "Sig-Assist-Windows-Demo.zip", "w", compression=ZIP_DEFLATED, compresslevel=9) as archive:
      for name, data in contents.items():
        entry = ZipInfo(name, date_time=(2026, 10, 1, 0, 0, 0))
        entry.compress_type = ZIP_DEFLATED
        entry.create_system = 0
        entry.external_attr = 0
        archive.writestr(entry, data, compresslevel=9)
    print("Packaged Sig-Assist-Windows-Demo.zip")
