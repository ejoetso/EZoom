"""Build the EZoom screenshot walkthrough video.

Usage: python scripts/create_demo_video.py <ffmpeg-executable>
"""

from pathlib import Path
import subprocess
import sys
import tempfile

from PIL import Image, ImageDraw, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
SCREENSHOTS = ROOT / "docs" / "screenshots"
OUTPUT = ROOT / "docs" / "EZoom-demo.mp4"

STEPS = [
    ("01-landing.png", "1. Start on the EZoom landing page"),
    ("02-educator-sign-in.png", "2. Sign in with the public 30-minute trial account"),
    ("03-create-session.png", "3. Enter the meeting details and create a session"),
    ("04-educator-lobby.png", "4. Confirm camera, microphone, and broadcast quality"),
    ("05-live-classroom.png", "5. Use the live classroom controls, timer, and teaching tools"),
    ("06-student-join.png", "6. Students enter their details, room code, and math answer"),
    ("07-student-classroom.png", "7. Students receive the educator camera, voice, and content"),
]


def font(size: int, bold: bool = False):
    filename = "arialbd.ttf" if bold else "arial.ttf"
    try:
        return ImageFont.truetype(filename, size)
    except OSError:
        return ImageFont.load_default()


def render_frame(source: Path, caption: str) -> Image.Image:
    canvas = Image.new("RGB", (1280, 720), "#07111f")
    draw = ImageDraw.Draw(canvas)
    draw.rectangle((0, 0, 1280, 72), fill="#0f172a")
    draw.text((42, 20), "EZoom Product Walkthrough", fill="#34d399", font=font(30, True))

    with Image.open(source) as screenshot:
        screenshot = screenshot.convert("RGB")
        fitted = ImageOps.contain(screenshot, (1200, 550), Image.Resampling.LANCZOS)
        x = (1280 - fitted.width) // 2
        y = 82 + (550 - fitted.height) // 2
        canvas.paste(fitted, (x, y))

    draw.rectangle((0, 642, 1280, 720), fill="#0f172a")
    draw.text((42, 664), caption, fill="white", font=font(25, True))
    return canvas


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Pass the ffmpeg executable path as the only argument.")
    ffmpeg = Path(sys.argv[1])
    if not ffmpeg.exists():
        raise SystemExit(f"ffmpeg not found: {ffmpeg}")

    with tempfile.TemporaryDirectory(prefix="ezoom-demo-") as temp_name:
        temp = Path(temp_name)
        concat_lines: list[str] = []
        for index, (filename, caption) in enumerate(STEPS, start=1):
            frame_path = temp / f"frame-{index:02d}.png"
            render_frame(SCREENSHOTS / filename, caption).save(frame_path, optimize=True)
            concat_lines.extend([f"file '{frame_path.as_posix()}'", "duration 4"])
        concat_lines.append(f"file '{frame_path.as_posix()}'")
        concat_path = temp / "frames.txt"
        concat_path.write_text("\n".join(concat_lines), encoding="utf-8")

        subprocess.run(
            [
                str(ffmpeg), "-y", "-f", "concat", "-safe", "0", "-i", str(concat_path),
                "-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-preset", "medium",
                "-movflags", "+faststart", str(OUTPUT),
            ],
            check=True,
        )

    print(OUTPUT)


if __name__ == "__main__":
    main()
