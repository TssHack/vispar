"""Cut static Arad weights from the variable font.

React Native on Android can't select weights from a variable font, so the app ships one
static file per weight. Each file gets its own PostScript name so iOS doesn't merge them.

Usage:  pip install fonttools && python3 scripts/build-fonts.py
"""
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

FONTS = Path(__file__).resolve().parent.parent / "assets" / "fonts"
SOURCE = FONTS / "Arad-VF.ttf"
WEIGHTS = {"Regular": 400, "Medium": 500, "SemiBold": 600, "Bold": 700, "ExtraBold": 800}


def rename(font: TTFont, style: str, weight: int) -> None:
    name = font["name"]
    for rec in list(name.names):
        if rec.nameID in (1, 2, 3, 4, 6, 16, 17, 25):
            name.removeNames(nameID=rec.nameID)
    ribbi = style in ("Regular", "Bold")
    family = "Arad" if ribbi else f"Arad {style}"
    subfamily = style if ribbi else "Regular"
    for pid, eid, lid in ((3, 1, 0x409), (1, 0, 0)):
        name.setName(family, 1, pid, eid, lid)
        name.setName(subfamily, 2, pid, eid, lid)
        name.setName(f"2.0;Arad-{style}", 3, pid, eid, lid)
        name.setName(f"Arad {style}", 4, pid, eid, lid)
        name.setName(f"Arad-{style}", 6, pid, eid, lid)
        name.setName("Arad", 16, pid, eid, lid)
        name.setName(style, 17, pid, eid, lid)
    font["OS/2"].usWeightClass = weight
    sel = font["OS/2"].fsSelection & ~0b1100001
    font["OS/2"].fsSelection = sel | (0b100000 if style == "Bold" else 0b1000000)
    font["head"].macStyle = 1 if style == "Bold" else 0
    for table in ("fvar", "STAT"):
        if table in font:
            del font[table]


for style, weight in WEIGHTS.items():
    static = instancer.instantiateVariableFont(TTFont(SOURCE), {"wght": weight, "DSTY": 1})
    rename(static, style, weight)
    out = FONTS / f"Arad-{style}.ttf"
    static.save(out)
    print("wrote", out.name)
