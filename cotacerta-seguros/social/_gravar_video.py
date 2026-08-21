import os
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
html_path = os.path.join(HERE, "reels-seguro-empresarial-animado.html")
url = "file:///" + html_path.replace("\\", "/")
video_dir = os.path.join(HERE, "_video_raw")
os.makedirs(video_dir, exist_ok=True)

DURATION_MS = 19500

with sync_playwright() as p:
    browser = p.chromium.launch()
    context = browser.new_context(
        viewport={"width": 1080, "height": 1920},
        record_video_dir=video_dir,
        record_video_size={"width": 1080, "height": 1920},
    )
    page = context.new_page()
    page.goto(url)
    page.wait_for_timeout(DURATION_MS)
    page_video_path = page.video.path()
    context.close()
    browser.close()

print("VIDEO_PATH=" + page_video_path)
