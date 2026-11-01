"""Convert bundled OFL webfonts locally for ReportLab; no network access."""
from pathlib import Path
from .store import DATA

def register():
    from fontTools.ttLib import TTFont as WebFont
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    base = Path(__file__).resolve().parents[1] / 'public' / 'fonts'
    destination = DATA / 'pdf-fonts'
    destination.mkdir(exist_ok=True)
    for name, filename in [('Playfair','playfair-display-latin-400-normal'), ('Libre','libre-baskerville-latin-400-normal'), ('Instrument','instrument-serif-latin-400-italic')]:
        if name in pdfmetrics.getRegisteredFontNames():
            continue
        ttf = destination / (filename + '.ttf')
        if not ttf.exists():
            font = WebFont(base / (filename + '.woff2'))
            font.flavor = None
            font.save(ttf)
        pdfmetrics.registerFont(TTFont(name, str(ttf)))
