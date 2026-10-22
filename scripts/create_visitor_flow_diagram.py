from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "Flow_Visitor_Token_LiveChat.pdf"
W, H = 842, 595


def esc(s: str) -> str:
    return s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def text(cmd, x, y, value, size=10, color=(0.12, 0.15, 0.2), bold=False):
    font = "/F2" if bold else "/F1"
    r, g, b = color
    cmd += [f"{r} {g} {b} rg", "BT", f"{font} {size} Tf", f"{x} {y} Td", f"({esc(value)}) Tj", "ET"]


def rect(cmd, x, y, w, h, fill, stroke=(0.82, 0.84, 0.88), width=1):
    r, g, b = fill
    sr, sg, sb = stroke
    cmd += [f"{r} {g} {b} rg", f"{sr} {sg} {sb} RG", f"{width} w", f"{x} {y} {w} {h} re", "B"]


def line(cmd, x1, y1, x2, y2, color=(0.35, 0.4, 0.48), width=1.5):
    r, g, b = color
    cmd += [f"{r} {g} {b} RG", f"{width} w", f"{x1} {y1} m", f"{x2} {y2} l", "S"]


def arrow(cmd, x1, y1, x2, y2, label=None, label_x=None, label_y=None):
    line(cmd, x1, y1, x2, y2)
    if x2 >= x1:
        line(cmd, x2, y2, x2 - 7, y2 + 4)
        line(cmd, x2, y2, x2 - 7, y2 - 4)
    else:
        line(cmd, x2, y2, x2 + 7, y2 + 4)
        line(cmd, x2, y2, x2 + 7, y2 - 4)
    if label:
        text(cmd, label_x or (x1 + x2) / 2, label_y or y1 + 8, label, 8, (0.25, 0.3, 0.38))


def page_one():
    c = ["q", "1 1 1 rg", f"0 0 {W} {H} re", "f"]
    text(c, 42, 555, "Alur Visitor Token: Live Chat SolidChat", 20, (0.1, 0.12, 0.18), True)
    text(c, 42, 532, "Konsep sederhana: visitor session + pre-chat, tanpa identity token", 11, (0.35, 0.39, 0.46))

    lanes = [(42, 95, 235, 400, "App Flutter", (0.94, 0.97, 1.0)), (303, 95, 235, 400, "Backend Aplikasi", (0.97, 0.95, 1.0)), (564, 95, 235, 400, "SolidChat Server", (0.94, 1.0, 0.97))]
    for x, y, w, h, title, fill in lanes:
        rect(c, x, y, w, h, fill, (0.77, 0.8, 0.86), 1)
        rect(c, x, 462, w, 33, (0.15, 0.2, 0.3), (0.15, 0.2, 0.3), 1)
        text(c, x + 14, 474, title, 12, (1, 1, 1), True)

    boxes = [
        (70, 405, 180, 42, "1  User membuka Live Chat"),
        (70, 330, 180, 42, "2  SDK minta /session"),
        (70, 245, 180, 52, "4  SDK simpan visitorToken\ndan site configuration"),
        (70, 155, 180, 52, "6  User isi pre-chat\n(nama, email, telepon)"),
        (331, 330, 180, 42, "3  Server membuat\nvisitorToken otomatis"),
        (331, 155, 180, 52, "7  Data pre-chat dikirim\nke conversation"),
        (592, 330, 180, 42, "3  POST /session\nvisitorToken + site"),
        (592, 245, 180, 52, "5  Buat / lanjutkan\nconversation"),
        (592, 155, 180, 52, "8  Validasi visitorToken\nuntuk REST + Socket.IO"),
    ]
    for x, y, w, h, label in boxes:
        rect(c, x, y, w, h, (1, 1, 1), (0.55, 0.62, 0.72), 1)
        for i, row in enumerate(label.split("\n")):
            text(c, x + 10, y + h - 18 - i * 14, row, 9, (0.12, 0.16, 0.22), i == 0)

    arrow(c, 160, 405, 160, 372, "", 0, 0)
    arrow(c, 250, 351, 331, 351, "request", 270, 361)
    arrow(c, 511, 351, 592, 351, "sign + return", 522, 361)
    arrow(c, 682, 330, 682, 297, "", 0, 0)
    arrow(c, 592, 271, 250, 271, "visitorToken + site", 400, 283)
    arrow(c, 160, 245, 160, 207, "", 0, 0)
    arrow(c, 250, 181, 331, 181, "pre-chat", 270, 191)
    arrow(c, 511, 181, 592, 181, "lead + message", 522, 191)
    arrow(c, 682, 155, 682, 125, "realtime", 694, 138)
    text(c, 42, 62, "Tidak ada identityToken, CUSTOMER_IDENTITY_JWT_SECRET, atau endpoint token tambahan.", 10, (0.25, 0.3, 0.38), True)
    c.append("Q")
    return "\n".join(c)


def page_two():
    c = ["q", "1 1 1 rg", f"0 0 {W} {H} re", "f"]
    text(c, 42, 550, "Keterangan Flow Visitor Token", 20, (0.1, 0.12, 0.18), True)
    text(c, 42, 523, "Token yang dipakai hanya token sesi visitor dan dibuat oleh server SolidChat.", 11, (0.35, 0.39, 0.46))
    rect(c, 42, 410, 365, 82, (0.94, 0.97, 1.0), (0.65, 0.72, 0.82), 1)
    text(c, 58, 468, "visitorToken", 14, (0.1, 0.25, 0.55), True)
    text(c, 58, 445, "- dibuat otomatis oleh SolidChat", 10)
    text(c, 58, 428, "- disimpan dan dikirim otomatis oleh SDK", 10)
    text(c, 58, 411, "- dipakai untuk REST API dan Socket.IO", 10)
    rect(c, 435, 410, 365, 82, (0.97, 0.95, 1.0), (0.75, 0.68, 0.82), 1)
    text(c, 451, 468, "Pre-chat", 14, (0.45, 0.2, 0.55), True)
    text(c, 451, 445, "- user mengisi nama, email, dan telepon", 10)
    text(c, 451, 428, "- data dikaitkan ke conversation", 10)
    text(c, 451, 411, "- user tidak perlu login", 10)
    text(c, 42, 360, "Yang tidak dipakai", 14, (0.1, 0.12, 0.18), True)
    for i, row in enumerate([
        "identityToken dari backend aplikasi",
        "CUSTOMER_IDENTITY_JWT_SECRET",
        "CUSTOMER_IDENTITY_ISSUER dan CUSTOMER_IDENTITY_AUDIENCE",
        "secret atau token tambahan di APK/IPA",
    ]):
        text(c, 58, 332 - i * 24, "- " + row, 11, (0.22, 0.26, 0.33))
    text(c, 42, 215, "Konsekuensi", 14, (0.1, 0.12, 0.18), True)
    for i, row in enumerate([
        "Semua user dapat memakai Live Chat sebagai visitor.",
        "Data pre-chat bukan bukti bahwa user memiliki akun login tertentu.",
        "Jika nanti perlu menghubungkan chat ke akun login, identity flow dapat ditambahkan terpisah.",
    ]):
        text(c, 58, 187 - i * 24, "- " + row, 11, (0.22, 0.26, 0.33))
    c.append("Q")
    return "\n".join(c)


streams = [page_one(), page_two()]
objects = []
for stream in streams:
    data = stream.encode("latin-1")
    objects.append((len(objects) + 4, f"<< /Length {len(data)} >>\nstream\n".encode() + data + b"\nendstream"))
    objects.append((len(objects) + 4, b""))

catalog, pages, font = 1, 2, 3
page_ids = [objects[i][0] for i in range(1, len(objects), 2)]
for i in range(1, len(objects), 2):
    content_id = objects[i - 1][0]
    objects[i] = (objects[i][0], f"<< /Type /Page /Parent {pages} 0 R /MediaBox [0 0 {W} {H}] /Resources << /Font << /F1 {font} 0 R /F2 {font + 1} 0 R >> >> /Contents {content_id} 0 R >>".encode())
all_objects = [(catalog, f"<< /Type /Catalog /Pages {pages} 0 R >>".encode()), (pages, f"<< /Type /Pages /Kids [{' '.join(f'{x} 0 R' for x in page_ids)}] /Count {len(page_ids)} >>".encode()), (font, b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"), (font + 1, b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>")] + objects
max_id = max(x[0] for x in all_objects)
pdf = bytearray(b"%PDF-1.4\n")
offsets = [0] * (max_id + 1)
for obj_id, body in all_objects:
    offsets[obj_id] = len(pdf)
    pdf.extend(f"{obj_id} 0 obj\n".encode())
    pdf.extend(body)
    pdf.extend(b"\nendobj\n")
xref = len(pdf)
pdf.extend(f"xref\n0 {max_id + 1}\n0000000000 65535 f \n".encode())
for obj_id in range(1, max_id + 1):
    pdf.extend(f"{offsets[obj_id]:010d} 00000 n \n".encode())
pdf.extend(f"trailer\n<< /Size {max_id + 1} /Root {catalog} 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode())
OUT.write_bytes(pdf)
print(OUT)
