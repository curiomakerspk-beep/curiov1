"""
Proper HTML splitter using a state-machine parser.
Correctly handles <style>/<script> text inside JS strings/comments.
- All <style> blocks -> css/<css_name>.css
- Large inline <script> blocks -> js/<js_prefix>_NN.js
- Tiny critical inline scripts stay inline (<= 40 lines)
- base64 SVG in CSS -> assets/img/img_NNN.svg

Usage:
    python split_html.py                                   # splits index.html (original behavior)
    python split_html.py train.html --css-name train --js-prefix train_block
"""

import os, re, base64, shutil, argparse, sys

BASE = os.path.dirname(os.path.abspath(__file__))

parser = argparse.ArgumentParser()
parser.add_argument("target", nargs="?", default="index.html", help="HTML file to split (relative to this folder)")
parser.add_argument("--css-name", default="main", help="Output css/<name>.css (default: main)")
parser.add_argument("--js-prefix", default="block", help="Output js/<prefix>_NN.js (default: block)")
parser.add_argument("--inline-limit", type=int, default=40, help="Scripts with <= this many lines stay inline")
args = parser.parse_args()

HTML_IN  = os.path.join(BASE, args.target)
HTML_BAK = HTML_IN + ".bak"
CSS_DIR  = os.path.join(BASE, "css")
JS_DIR   = os.path.join(BASE, "js")
IMG_DIR  = os.path.join(BASE, "assets", "img")

if not os.path.isfile(HTML_IN):
    print(f"File not found: {HTML_IN}")
    sys.exit(1)

shutil.copy2(HTML_IN, HTML_BAK)
print(f"Backup saved -> {os.path.basename(HTML_BAK)}")

with open(HTML_IN, "r", encoding="utf-8", errors="ignore") as f:
    lines = f.readlines()

os.makedirs(CSS_DIR, exist_ok=True)
os.makedirs(JS_DIR,  exist_ok=True)
os.makedirs(IMG_DIR, exist_ok=True)

# ============================================================
# State-machine: walk lines tracking whether we are inside
# a <script> or <style> tag, to avoid regex mis-matches.
# ============================================================
INLINE_LINE_LIMIT = args.inline_limit

css_chunks  = []
css_pending = []   # lines of the current <style> block

js_blocks   = []   # list of (lines[], attrs)
js_pending  = []
js_attrs    = ""

inline_out  = []   # rebuilt HTML lines

in_script   = False
in_style    = False

i = 0
while i < len(lines):
    line = lines[i]
    stripped = line.strip()

    # ── detect opening tags (only when NOT already inside a block) ──
    if not in_script and not in_style:

        # <style ...>  opening tag
        m = re.match(r'<style([^>]*)>', stripped, re.IGNORECASE)
        if m and not stripped.startswith("</style"):
            in_style = True
            css_pending = []
            # rest of line after the tag
            rest_after = re.sub(r'^<style[^>]*>', '', stripped, flags=re.IGNORECASE)
            if '</style>' in rest_after:
                # whole block on one line
                inner = rest_after[:rest_after.index('</style>')]
                css_chunks.append(inner)
                in_style = False
                inline_out.append("")
            elif rest_after.strip():
                css_pending.append(rest_after + "\n")
            i += 1
            continue

        # <script ...> opening tag — with or without src
        ms = re.match(r'<script([^>]*)>', stripped, re.IGNORECASE)
        if ms:
            attrs = ms.group(1) or ""
            if 'src=' in attrs:
                # external script — keep as-is
                inline_out.append(line)
                i += 1
                continue
            in_script = True
            js_pending = []
            js_attrs   = attrs
            rest_after = re.sub(r'^<script[^>]*>', '', stripped, flags=re.IGNORECASE)
            if '</script>' in rest_after:
                inner = rest_after[:rest_after.index('</script>')]
                nlines = inner.count('\n')
                if nlines <= INLINE_LINE_LIMIT:
                    inline_out.append(f'<script{attrs}>{inner}</script>\n')
                else:
                    js_blocks.append((inner.split('\n'), attrs))
                    n = len(js_blocks)
                    inline_out.append(f'  <script{attrs} src="js/{args.js_prefix}_{n:02d}.js"></script>\n')
                in_script = False
                i += 1
                continue
            elif rest_after.strip():
                js_pending.append(rest_after + "\n")
            i += 1
            continue

        # normal line
        inline_out.append(line)
        i += 1
        continue

    # ── inside <style> block ─────────────────────────────────────────
    if in_style:
        if '</style>' in stripped:
            # capture everything before </style>
            before = line[:line.lower().index('</style>')]
            css_pending.append(before)
            css_chunks.append("".join(css_pending))
            css_pending = []
            in_style = False
            inline_out.append("")   # placeholder removed
        else:
            css_pending.append(line)
        i += 1
        continue

    # ── inside <script> block ────────────────────────────────────────
    if in_script:
        if '</script>' in line:
            before = line[:line.lower().index('</script>')]
            js_pending.append(before)
            content = "".join(js_pending)
            nlines  = content.count('\n')
            if nlines <= INLINE_LINE_LIMIT:
                inline_out.append(f'<script{js_attrs}>{content}</script>\n')
            else:
                js_blocks.append((content, js_attrs))
                n = len(js_blocks)
                inline_out.append(f'  <script{js_attrs} src="js/{args.js_prefix}_{n:02d}.js"></script>\n')
            js_pending = []
            in_script  = False
        else:
            js_pending.append(line)
        i += 1
        continue

    i += 1

# ============================================================
# Write CSS
# ============================================================
if css_chunks:
    css_path = os.path.join(CSS_DIR, f"{args.css_name}.css")

    # extract base64 SVG from CSS before writing
    img_counter = [0]
    def replace_svg_b64(m):
        b64data = m.group(1)
        img_counter[0] += 1
        fname = f"img_{img_counter[0]:03d}.svg"
        fpath = os.path.join(IMG_DIR, fname)
        try:
            with open(fpath, "wb") as f:
                f.write(base64.b64decode(b64data))
            return f'url(../assets/img/{fname})'
        except Exception:
            return m.group(0)

    css_combined = "\n\n/* --- block separator --- */\n\n".join(css_chunks)
    css_combined = re.sub(
        r'url\(["\']?data:image/svg\+xml;base64,([A-Za-z0-9+/=\s]+?)["\']?\)',
        replace_svg_b64,
        css_combined
    )

    with open(css_path, "w", encoding="utf-8") as f:
        f.write(css_combined)

    css_kb = os.path.getsize(css_path) // 1024
    print(f"CSS  -> css/{args.css_name}.css  ({len(css_chunks)} blocks, {css_kb} KB)")
    if img_counter[0]:
        print(f"SVG  -> {img_counter[0]} SVG images extracted to assets/img/")

# ============================================================
# Write JS blocks
# ============================================================
for n, (content, attrs) in enumerate(js_blocks, 1):
    fname  = f"{args.js_prefix}_{n:02d}.js"
    fpath  = os.path.join(JS_DIR, fname)
    nlines = content.count('\n')
    with open(fpath, "w", encoding="utf-8") as f:
        f.write(content)
    kb = os.path.getsize(fpath) // 1024
    print(f"JS   -> js/{fname}  ({nlines} lines, {kb} KB)")

# ============================================================
# Inject <link> for CSS and write new HTML
# ============================================================
html_out = "".join(inline_out)
if css_chunks:
    link_tag = f'  <link rel="stylesheet" href="css/{args.css_name}.css" />\n'
    html_out = html_out.replace("</head>", link_tag + "</head>", 1)

with open(HTML_IN, "w", encoding="utf-8") as f:
    f.write(html_out)

orig_kb = os.path.getsize(HTML_BAK) // 1024
new_kb  = os.path.getsize(HTML_IN)  // 1024
print(f"\nDone!")
print(f"  Before : {orig_kb:,} KB")
print(f"  After  : {new_kb:,} KB")
if orig_kb:
    print(f"  Saved  : {orig_kb - new_kb:,} KB  ({100*(orig_kb-new_kb)//orig_kb}% smaller)")
