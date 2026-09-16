"""Remove the known presentation border from generated product-card thumbnails.

The source image remains completely intact inside the crop.  The 64px rim on
each side was added solely while placing the original photo on a 640px canvas;
keeping it makes the product look undersized once the card adds its own safe
padding.
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


CARD_IMAGES = Path(__file__).resolve().parents[1] / "assets" / "images" / "product-cards"
CANVAS_SIZE = 640
PRESENTATION_BORDER = 64


def main() -> None:
    files = sorted(CARD_IMAGES.glob("*.webp"))
    changed = 0

    for image_path in files:
        with Image.open(image_path) as image:
            content = image.convert("RGB")
            if content.size == (CANVAS_SIZE, CANVAS_SIZE):
                content = content.crop(
                    (
                        PRESENTATION_BORDER,
                        PRESENTATION_BORDER,
                        CANVAS_SIZE - PRESENTATION_BORDER,
                        CANVAS_SIZE - PRESENTATION_BORDER,
                    )
                )

            pixels = np.asarray(content, dtype=np.int16)
            height, width = pixels.shape[:2]
            sample_size = max(4, min(width, height) // 32)
            corners = np.concatenate(
                (
                    pixels[:sample_size, :sample_size].reshape(-1, 3),
                    pixels[:sample_size, -sample_size:].reshape(-1, 3),
                    pixels[-sample_size:, :sample_size].reshape(-1, 3),
                    pixels[-sample_size:, -sample_size:].reshape(-1, 3),
                )
            )
            background = np.median(corners, axis=0)
            corner_distance = np.linalg.norm(corners - background, axis=1)
            light_neutral_background = (
                np.mean(background) >= 220
                and np.max(background) - np.min(background) <= 24
                and np.mean(corner_distance < 15) >= 0.82
            )

            if light_neutral_background:
                distance = np.linalg.norm(pixels - background, axis=2)
                mask = Image.fromarray((distance > 18).astype(np.uint8) * 255)
                mask = mask.filter(ImageFilter.MaxFilter(7))
                box = mask.getbbox()
                if box:
                    left, top, right, bottom = box
                    pad_x = max(8, round((right - left) * 0.05))
                    pad_y = max(8, round((bottom - top) * 0.05))
                    crop_box = (
                        max(0, left - pad_x),
                        max(0, top - pad_y),
                        min(width, right + pad_x),
                        min(height, bottom + pad_y),
                    )
                    removed_ratio = 1 - ((crop_box[2] - crop_box[0]) * (crop_box[3] - crop_box[1])) / (width * height)
                    if removed_ratio >= 0.08:
                        content = content.crop(crop_box)

            content.save(image_path, "WEBP", quality=91, method=6)
            changed += 1

    print(f"Trimmed the generated border from {changed}/{len(files)} product-card thumbnails.")


if __name__ == "__main__":
    main()
