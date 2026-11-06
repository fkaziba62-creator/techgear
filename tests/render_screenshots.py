"""Turns tests/screenshots/html/*.html (rendered pages saved by e2e_checkout.js) into PNG screenshots.
Needs: pip install weasyprint pymupdf pillow"""
import os, glob, io, fitz, weasyprint
from PIL import Image, ImageChops
here = os.path.dirname(os.path.abspath(__file__)); src = os.path.join(here, "screenshots", "html"); dst = os.path.join(here, "screenshots")
for f in sorted(glob.glob(os.path.join(src, "*.html"))):
    html = weasyprint.HTML(filename=f)
    pdf = html.render(stylesheets=[weasyprint.CSS(string="@page{size:1100px 2400px;margin:0}")]).write_pdf()
    pix = fitz.open(stream=pdf, filetype="pdf")[0].get_pixmap(dpi=96)
    im = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
    bg = Image.new("RGB", im.size, im.getpixel((im.width - 1, im.height - 1)))
    box = ImageChops.difference(im, bg).getbbox()
    if box: im = im.crop((0, 0, im.width, min(im.height, box[3] + 24)))
    out = os.path.join(dst, os.path.basename(f)[:-5] + ".png"); im.save(out); print("saved", os.path.relpath(out, os.path.dirname(here)))
