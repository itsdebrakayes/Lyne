from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parent


def numeric_page(path: Path) -> int:
    return int(path.stem.split("-")[-1])


def make_sheet(folder_name: str, output_name: str, columns: int = 3) -> None:
    folder = ROOT / folder_name
    pages = sorted(folder.glob("page-*.png"), key=numeric_page)
    if not pages:
        return

    with Image.open(pages[0]) as first:
        page_width, page_height = first.size
    thumb_width = 360
    thumb_height = round(page_height * thumb_width / page_width)
    label_height = 26
    rows = (len(pages) + columns - 1) // columns
    sheet = Image.new(
        "RGB",
        (columns * thumb_width, rows * (thumb_height + label_height)),
        "white",
    )
    draw = ImageDraw.Draw(sheet)

    for index, page_path in enumerate(pages):
        with Image.open(page_path) as page:
            thumb = page.convert("RGB")
            thumb.thumbnail((thumb_width, thumb_height))
        x = (index % columns) * thumb_width
        y = (index // columns) * (thumb_height + label_height)
        sheet.paste(thumb, (x, y + label_height))
        draw.text((x + 8, y + 6), f"Page {index + 1}", fill="#17324D")

    sheet.save(ROOT / output_name, quality=92)


make_sheet("qmenow_budget_render", "qmenow_budget_contact.png")
make_sheet("qmenow_feasibility_render", "qmenow_feasibility_contact.png")
make_sheet("qmenow_budget_render_final", "qmenow_budget_contact_final.png")
make_sheet("qmenow_feasibility_render_final", "qmenow_feasibility_contact_final.png")
