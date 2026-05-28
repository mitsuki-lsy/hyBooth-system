import json
import os
import sys


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOCAL_DEPS = os.path.join(ROOT, ".python_deps")
if os.path.isdir(LOCAL_DEPS) and LOCAL_DEPS not in sys.path:
    sys.path.insert(0, LOCAL_DEPS)


def fail(message):
    sys.stderr.write(message)
    sys.exit(1)


def main():
    if len(sys.argv) < 3:
        fail("Usage: pdf_first_page_to_png.py input.pdf output.png [scale]")
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    scale = float(sys.argv[3]) if len(sys.argv) > 3 else 2.0
    scale = max(1.0, min(scale, 4.0))

    try:
        import pypdfium2 as pdfium
        from PIL import Image
    except Exception as exc:
        fail(f"Missing PDF render dependency: {exc}")

    try:
        pdf = pdfium.PdfDocument(input_path)
        if len(pdf) < 1:
            fail("PDF has no pages")
        page = pdf[0]
        bitmap = page.render(scale=scale)
        image = bitmap.to_pil()
        if image.mode == "RGBA":
            background = Image.new("RGB", image.size, "white")
            background.paste(image, mask=image.getchannel("A"))
            image = background
        elif image.mode != "RGB":
            image = image.convert("RGB")
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        image.save(output_path, "PNG", optimize=True)
        node = {"width": image.width, "height": image.height}
        print(json.dumps(node, ensure_ascii=False))
    except SystemExit:
        raise
    except Exception as exc:
        fail(f"PDF render failed: {exc}")


if __name__ == "__main__":
    main()
