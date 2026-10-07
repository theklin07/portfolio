#!/usr/bin/env python3
"""
Get new photos ready for the website (and for Cloudinary).

Drop photos (iPhone .HEIC, .JPG or .PNG) into
    Photography/Photography/   or   Photography/Hearts/
then run, from the Portfolio folder:
    python3 tools/prepare-photos.py

For each photo that isn't web-ready yet it:
  * converts it to JPEG (HEIC through macOS's built-in `sips`)
  * rotates it upright and resizes it: 2000px, plus a 900px copy in thumbs/
  * removes all metadata, including GPS location, keeping only the colour profile
  * moves the original out of the site into Photography/_originals/

Then upload the new .jpg files (not the HEIC originals) to Cloudinary, keeping
each filename as its public ID, and paste the printed lines into window.PHOTOS
in assets/js/content.js. The local copies stay as the site's fallback if
Cloudinary ever fails to deliver a photo.
"""
import os, re, shutil, subprocess, sys, tempfile

try:
    from PIL import Image, ImageOps
except ImportError:
    sys.exit("Needs Pillow:  python3 -m pip install Pillow")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FOLDERS = [("Photography/Photography", "daily"), ("Photography/Hearts", "hearts")]
EXTS = (".heic", ".heif", ".jpg", ".jpeg", ".png")


def web_name(filename):
    base = re.sub(r"[^a-z0-9]+", "-", os.path.splitext(filename)[0].lower()).strip("-")
    return base + ".jpg"


def is_ready(path, thumb):
    if not (path.endswith(".jpg") and os.path.exists(thumb)):
        return False
    im = Image.open(path)
    return not len(im.getexif()) and max(im.size) <= 2000


def prepare(folder):
    src_dir = os.path.join(ROOT, folder)
    thumbs = os.path.join(src_dir, "thumbs")
    originals = os.path.join(ROOT, "Photography", "_originals", os.path.basename(folder))
    os.makedirs(thumbs, exist_ok=True)
    made = []
    for fn in sorted(os.listdir(src_dir)):
        path = os.path.join(src_dir, fn)
        if fn.startswith(".") or not fn.lower().endswith(EXTS) or not os.path.isfile(path):
            continue
        name = web_name(fn)
        if fn == name and is_ready(path, os.path.join(thumbs, name)):
            continue

        work = path
        if fn.lower().endswith((".heic", ".heif")):
            work = os.path.join(tempfile.mkdtemp(), name)
            subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", "100", path, "--out", work],
                           check=True, capture_output=True)
        im = Image.open(work)
        icc = im.info.get("icc_profile")
        im = ImageOps.exif_transpose(im).convert("RGB")

        # move the original aside before writing, in case it has the same name
        os.makedirs(originals, exist_ok=True)
        shutil.move(path, os.path.join(originals, fn))

        for size, out_dir, quality in [(2000, src_dir, 84), (900, thumbs, 80)]:
            copy = im.copy()
            copy.thumbnail((size, size), Image.LANCZOS)
            options = dict(quality=quality, optimize=True, progressive=True)
            if icc:
                options["icc_profile"] = icc
            copy.save(os.path.join(out_dir, name), "JPEG", **options)
        made.append(f"{folder}/{name}")
    return made


def main():
    any_new = False
    for folder, key in FOLDERS:
        if not os.path.isdir(os.path.join(ROOT, folder)):
            continue
        made = prepare(folder)
        if made:
            any_new = True
            print(f"\n// paste into  {key}: [ ... ]  in assets/js/content.js")
            for f in made:
                public_id = os.path.splitext(os.path.basename(f))[0]
                print(f'    {{ file: "{public_id}", alt: "describe the photo" }},   // upload {f}')
    if not any_new:
        print("Nothing new: every photo is already web-ready.")


if __name__ == "__main__":
    main()
