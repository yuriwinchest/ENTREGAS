"""Gera o chipower.ico multi-resolução a partir do cronômetro recortado."""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src" / "EntregaDeKits.App" / "Resources" / "chipower-icon.png"
TARGET = ROOT / "src" / "EntregaDeKits.App" / "Resources" / "chipower.ico"
SIZES = [(16, 16), (20, 20), (24, 24), (32, 32), (40, 40), (48, 48), (64, 64), (128, 128), (256, 256)]


def main() -> None:
    image = Image.open(SOURCE).convert("RGBA")
    image.save(TARGET, format="ICO", sizes=SIZES)
    print(f"escrito {TARGET} ({TARGET.stat().st_size} bytes) com {len(SIZES)} tamanhos")


if __name__ == "__main__":
    main()
