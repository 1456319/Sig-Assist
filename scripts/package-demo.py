"""Package the already-built demo deterministically for download."""
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

demo = Path(__file__).resolve().parent.parent / "windows-demo"
files = ["Start-Sig-Assist.bat", "Serve-Demo.ps1", "README.txt", "index.html"]
with ZipFile(demo / "Sig-Assist-Windows-Demo.zip", "w", compression=ZIP_DEFLATED, compresslevel=9) as archive:
    for name in files:
        data = (demo / name).read_bytes().replace(b"\r\n", b"\n")
        if name.endswith((".bat", ".ps1", ".txt")):
            data = data.replace(b"\n", b"\r\n")
        entry = ZipInfo(name, date_time=(2026, 10, 1, 0, 0, 0))
        entry.compress_type = ZIP_DEFLATED
        entry.create_system = 0
        entry.external_attr = 0
        archive.writestr(entry, data, compresslevel=9)
print("Packaged Sig-Assist-Windows-Demo.zip")
