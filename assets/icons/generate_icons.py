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
    """Create the base SVG icon for Sentinel Agent — Abstract S monogram."""
    svg = '''<?xml version="1.0" encoding="UTF-8"?>
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Background gradient: deep black to dark navy -->
    <linearGradient id="bg-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0a0a0f;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#10132a;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#0d1025;stop-opacity:1" />
    </linearGradient>

    <!-- Subtle sheen on the S -->
    <linearGradient id="s-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#ffffff;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#c0c8e8;stop-opacity:1" />
    </linearGradient>

    <!-- Drop shadow for depth -->
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="12" flood-color="#6366f1" flood-opacity="0.15"/>
    </filter>
  </defs>

  <!-- iOS-style Squircle Background -->
  <rect width="1024" height="1024" rx="224" ry="224" fill="url(#bg-gradient)"/>

  <!-- Abstract interlocking S — built from two flowing curves -->
  <g transform="translate(512, 512)" filter="url(#shadow)">
    <!-- Upper S curve -->
    <path d="M-40,-280 C200,-280 260,-220 260,-100 C260,0 180,60 40,60 C-60,60 -160,40 -200,20"
          fill="none" stroke="url(#s-gradient)" stroke-width="72" stroke-linecap="round"/>
    <!-- Lower S curve -->
    <path d="M40,280 C-200,280 -260,220 -260,100 C-260,0 -180,-60 -40,-60 C60,-60 160,-40 200,-20"
          fill="none" stroke="url(#s-gradient)" stroke-width="72" stroke-linecap="round"/>
  </g>
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
