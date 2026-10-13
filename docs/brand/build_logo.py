# Copyright 2026 The Tarn Authors
# SPDX-License-Identifier: Apache-2.0

"""Builds Tarn's wordmark and mark as outlined SVGs.

The outputs in docs/brand/assets/ are committed, so nobody needs to run this
unless the brand itself changes. Everything that defines the marks lives in
the constants below; docs/brand/BRAND.md explains each one.

Setup (any Python 3.10+):
    python3 -m venv .venv && .venv/bin/pip install fonttools uharfbuzz brotli
Font: Google Sans Flex variable TTF from Google Fonts (SIL OFL 1.1), e.g.
    https://github.com/google/fonts/tree/main/ofl/googlesansflex
or the bundled subset converted to TTF (same outlines; needs `brotli`):
    .venv/bin/python -c "from fontTools.ttLib import TTFont; f = TTFont('public/fonts/google-sans-flex-latin.woff2'); f.flavor = None; f.save('GoogleSansFlex.ttf')"
Run:
    .venv/bin/python docs/brand/build_logo.py --font GoogleSansFlex.ttf
"""

import argparse
import pathlib

import uharfbuzz as hb
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

# Brand colors (docs/brand/BRAND.md, "Color"): pure black and white.
BLACK = '#000000'
WHITE = '#FFFFFF'

# Shared type settings: default Google Sans Flex, never rounded or widened.
BASE_AXES = {'wdth': 100, 'ROND': 0, 'slnt': 0, 'opsz': 144}

# The mark: "ta" in a 128 x 128 rounded square, the "a" cut in half by the
# right edge. Coordinates are in the square's own units (y grows downward).
MARK = {
    'text': 'ta',
    'weight': 600,
    'size': 150,  # font size in square units
    'x': 34,  # left edge of the pen
    'baseline': 116,
    'tracking': -0.04,  # em
    'square': 128,
    'radius': 30,
    'opsz': 144,
}

# The small master, for 16-32px: the same mark drawn from the font's small
# optical size, whose wider counters keep the "a" open at toolbar size.
MARK_SMALL = {**MARK, 'opsz': 18}

# The wordmark: lowercase "tarn", drawn from the font's text optical size
# with extra space before the "n", so "rn" never reads as "m" from a
# distance. The display size (144) and a hair of gap read "tam" (measured
# 2026-10-13; docs/brand/BRAND.md, "The r-n rule").
WORDMARK = {
    'text': 'tarn',
    'weight': 500,
    'size': 100,
    'opsz': 32,
    'tracking': -0.03,  # em, between every letter
    'rn_gap': 0.06,  # em, added between "r" and "n" only
    'pad': 0,  # extra space around the ink; clear space lives in BRAND.md
}

HEADER = '<!-- Tarn brand asset. Built by docs/brand/build_logo.py; see docs/brand/BRAND.md. -->\n'


def axes(font_path, weight, opsz):
  """The default design at this weight and optical size, limited to the axes
  the font has (the bundled subset in public/fonts/ pins all but wght and
  opsz to their defaults, so it draws the same outlines)."""
  tags = {a.axisTag for a in TTFont(str(font_path))['fvar'].axes}
  return {k: v for k, v in {**BASE_AXES, 'opsz': opsz, 'wght': weight}.items()
          if k in tags}


def shape(font_path, text, weight, opsz=144):
  """Returns [(glyph_name, x_advance, x_offset, y_offset)] in font units."""
  blob = hb.Blob.from_file_path(str(font_path))
  face = hb.Face(blob)
  font = hb.Font(face)
  font.set_variations(axes(font_path, weight, opsz))
  buf = hb.Buffer()
  buf.add_str(text)
  buf.guess_segment_properties()
  hb.shape(font, buf, {'kern': True, 'liga': True})
  # Glyph ids, not HarfBuzz's names: the subset has no glyph names.
  order = TTFont(str(font_path)).getGlyphOrder()
  names = [order[i.codepoint] for i in buf.glyph_infos]
  return [(n, p.x_advance, p.x_offset, p.y_offset)
          for n, p in zip(names, buf.glyph_positions)]


def instance(font_path, weight, opsz=144):
  from fontTools.varLib.instancer import instantiateVariableFont
  font = TTFont(str(font_path))
  return instantiateVariableFont(font, axes(font_path, weight, opsz))


def outline(font, glyphs, size, x, baseline, tracking, extra=None):
  """Draws shaped glyphs as one SVG path string. y grows downward."""
  upm = font['head'].unitsPerEm
  scale = size / upm
  glyph_set = font.getGlyphSet()
  parts, pen_x = [], x
  bounds = [float('inf'), float('inf'), float('-inf'), float('-inf')]
  for i, (name, adv, dx, dy) in enumerate(glyphs):
    if extra and i in extra:
      pen_x += extra[i] * size
    svg = SVGPathPen(glyph_set, ntos=lambda v: f'{v:.2f}'.rstrip('0').rstrip('.'))
    ox, oy = pen_x + dx * scale, baseline - dy * scale
    glyph_set[name].draw(TransformPen(svg, (scale, 0, 0, -scale, ox, oy)))
    parts.append(svg.getCommands())
    glyph = font['glyf'][name]
    if glyph.numberOfContours:
      glyph.recalcBounds(font['glyf'])
      bounds[0] = min(bounds[0], ox + glyph.xMin * scale)
      bounds[2] = max(bounds[2], ox + glyph.xMax * scale)
      bounds[1] = min(bounds[1], oy - glyph.yMax * scale)
      bounds[3] = max(bounds[3], oy - glyph.yMin * scale)
    pen_x += adv * scale + tracking * size
  return ' '.join(parts), bounds


def build_mark(font_path, out, m=MARK, suffix=''):
  font = instance(font_path, m['weight'], m['opsz'])
  glyphs = shape(font_path, m['text'], m['weight'], m['opsz'])
  d, _ = outline(font, glyphs, m['size'], m['x'], m['baseline'], m['tracking'])
  s, r = m['square'], m['radius']
  square = f'<rect width="{s}" height="{s}" rx="{r}"/>'

  def svg(bg, fg, edge=False, title='Tarn'):
    border = (f'<rect x=".5" y=".5" width="{s - 1}" height="{s - 1}" rx="{r - .5}" '
              f'fill="none" stroke="{BLACK}" stroke-opacity=".14"/>') if edge else ''
    return (f'{HEADER}<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {s} {s}" '
            f'width="{s}" height="{s}" role="img" aria-label="{title}">'
            f'<defs><clipPath id="tarn-sq">{square}</clipPath></defs>'
            f'<g clip-path="url(#tarn-sq)"><rect width="{s}" height="{s}" fill="{bg}"/>'
            f'<path fill="{fg}" d="{d}"/></g>{border}</svg>\n')

  (out / f'tarn-mark{suffix}.svg').write_text(svg(BLACK, WHITE))
  (out / f'tarn-mark-white{suffix}.svg').write_text(svg(WHITE, BLACK, edge=True))
  # One color: the square in currentColor with the letters knocked out.
  (out / f'tarn-mark-mono{suffix}.svg').write_text(
      f'{HEADER}<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {s} {s}" '
      f'width="{s}" height="{s}" role="img" aria-label="Tarn">'
      f'<defs><clipPath id="tarn-sq">{square}</clipPath>'
      f'<mask id="tarn-cut"><rect width="{s}" height="{s}" fill="#fff"/>'
      f'<path fill="#000" d="{d}"/></mask></defs>'
      f'<g clip-path="url(#tarn-sq)"><rect width="{s}" height="{s}" '
      f'fill="currentColor" mask="url(#tarn-cut)"/></g></svg>\n')


def build_wordmark(font_path, out):
  w = WORDMARK
  font = instance(font_path, w['weight'], w['opsz'])
  glyphs = shape(font_path, w['text'], w['weight'], w['opsz'])
  n_index = w['text'].index('n')
  d, (x0, y0, x1, y1) = outline(font, glyphs, w['size'], 0, 0, w['tracking'],
                                extra={n_index: w['rn_gap']})
  p = w['pad']
  vb = f'{x0 - p:.2f} {y0 - p:.2f} {x1 - x0 + 2 * p:.2f} {y1 - y0 + 2 * p:.2f}'
  width, height = x1 - x0 + 2 * p, y1 - y0 + 2 * p
  for name, color in [('tarn-wordmark.svg', BLACK),
                      ('tarn-wordmark-white.svg', WHITE),
                      ('tarn-wordmark-mono.svg', 'currentColor')]:
    (out / name).write_text(
        f'{HEADER}<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" '
        f'width="{width:.0f}" height="{height:.0f}" role="img" aria-label="Tarn">'
        f'<path fill="{color}" d="{d}"/></svg>\n')


def main():
  parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
  parser.add_argument('--font', required=True, type=pathlib.Path)
  parser.add_argument('--out', type=pathlib.Path,
                      default=pathlib.Path(__file__).parent / 'assets')
  args = parser.parse_args()
  args.out.mkdir(parents=True, exist_ok=True)
  build_mark(args.font, args.out)
  build_mark(args.font, args.out, MARK_SMALL, '-small')
  build_wordmark(args.font, args.out)
  print(f'Wrote SVGs to {args.out}')


if __name__ == '__main__':
  main()
