#!/usr/bin/env python3
"""
Generate application icons for macOS (.icns) and Windows (.ico) from an SVG source.
Requires: pip install pillow cairosvg
"""

import os
import subprocess
import sys
from pathlib import Path

# Icon sizes needed
MACOS_SIZES = [16, 32, 64, 128, 256, 512, 1024]
WINDOWS_SIZES = [16, 24, 32, 48, 64, 128, 256]

def create_base_icon_svg():
    """Create the base SVG icon for Sentinel Agent."""
    svg = '''<?xml version="1.0" encoding="UTF-8"?>
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="shield-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#4f46e5;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="check-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#22c55e;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#16a34a;stop-opacity:1" />
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="20" flood-color="#000" flood-opacity="0.25"/>
    </filter>
  </defs>

  <!-- Background circle -->
  <circle cx="512" cy="512" r="480" fill="white" filter="url(#shadow)"/>

  <!-- Shield shape -->
  <path d="M512 100 L820 220 L820 500 Q820 750 512 920 Q204 750 204 500 L204 220 Z"
        fill="url(#shield-gradient)"
        stroke="none"/>

  <!-- Inner shield highlight -->
  <path d="M512 150 L780 255 L780 490 Q780 710 512 860 Q244 710 244 490 L244 255 Z"
        fill="none"
        stroke="rgba(255,255,255,0.3)"
        stroke-width="4"/>

  <!-- Checkmark -->
  <path d="M380 520 L480 620 L680 380"
        fill="none"
        stroke="url(#check-gradient)"
        stroke-width="60"
        stroke-linecap="round"
        stroke-linejoin="round"/>

  <!-- Small "S" letter -->
  <text x="512" y="280"
        font-family="SF Pro Display, -apple-system, Helvetica Neue, Arial, sans-serif"
        font-size="100"
        font-weight="700"
        fill="rgba(255,255,255,0.9)"
        text-anchor="middle">S</text>
</svg>'''
    return svg

def main():
    script_dir = Path(__file__).parent
    svg_path = script_dir / "sentinel-icon.svg"

    # Create SVG
    print("Creating base SVG icon...")
    svg_content = create_base_icon_svg()
    svg_path.write_text(svg_content)
    print(f"  Created: {svg_path}")

    try:
        from PIL import Image
        import cairosvg
    except ImportError:
        print("\nTo generate PNG/ICO/ICNS icons, install dependencies:")
        print("  pip install pillow cairosvg")
        print("\nAlternatively, use the SVG directly or convert manually.")
        return

    # Generate PNGs for each size
    print("\nGenerating PNG icons...")
    png_dir = script_dir / "png"
    png_dir.mkdir(exist_ok=True)

    all_sizes = sorted(set(MACOS_SIZES + WINDOWS_SIZES))
    png_paths = {}

    for size in all_sizes:
        png_path = png_dir / f"icon_{size}x{size}.png"
        cairosvg.svg2png(
            url=str(svg_path),
            write_to=str(png_path),
            output_width=size,
            output_height=size
        )
        png_paths[size] = png_path
        print(f"  Created: {png_path}")

    # Create Windows ICO
    print("\nCreating Windows ICO...")
    ico_path = script_dir / "sentinel-agent.ico"
    ico_images = []
    for size in WINDOWS_SIZES:
        img = Image.open(png_paths[size])
        ico_images.append(img)

    ico_images[0].save(
        ico_path,
        format='ICO',
        sizes=[(s, s) for s in WINDOWS_SIZES],
        append_images=ico_images[1:]
    )
    print(f"  Created: {ico_path}")

    # Create macOS ICNS (requires iconutil on macOS)
    if sys.platform == 'darwin':
        print("\nCreating macOS ICNS...")
        iconset_dir = script_dir / "sentinel-agent.iconset"
        iconset_dir.mkdir(exist_ok=True)

        # macOS iconset naming convention
        macos_files = [
            (16, "icon_16x16.png"),
            (32, "icon_16x16@2x.png"),
            (32, "icon_32x32.png"),
            (64, "icon_32x32@2x.png"),
            (128, "icon_128x128.png"),
            (256, "icon_128x128@2x.png"),
            (256, "icon_256x256.png"),
            (512, "icon_256x256@2x.png"),
            (512, "icon_512x512.png"),
            (1024, "icon_512x512@2x.png"),
        ]

        for size, filename in macos_files:
            src = png_paths[size]
            dst = iconset_dir / filename
            Image.open(src).save(dst)

        icns_path = script_dir / "sentinel-agent.icns"
        subprocess.run(["iconutil", "-c", "icns", str(iconset_dir), "-o", str(icns_path)], check=True)
        print(f"  Created: {icns_path}")

        # Cleanup iconset
        import shutil
        shutil.rmtree(iconset_dir)
    else:
        print("\nSkipping ICNS creation (requires macOS)")

    print("\nDone! Icons created successfully.")

if __name__ == "__main__":
    main()
