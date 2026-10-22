from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "Flow_Visitor_Token_LiveChat.pdf"

pages = [
    [
        ("Flow Visitor Token - Live Chat SolidChat", 20),
        ("Konsep tanpa login dan tanpa identityToken", 12),
        ("", 10),
        ("ALUR UTAMA", 14),
        ("1. User membuka Live Chat di aplikasi.", 11),
        ("2. Flutter SDK memanggil POST /api/v1/widget/session.", 11),
        ("3. Server SolidChat membuat visitorToken otomatis.", 11),
        ("4. SDK menyimpan visitorToken dan site configuration.", 11),
        ("5. SDK membuat atau melanjutkan conversation.", 11),
        ("6. User mengisi pre-chat: nama, email, dan nomor telepon.", 11),
        ("7. SDK mengirim data pre-chat dan user mulai chat.", 11),
        ("8. SDK memakai visitorToken untuk REST API dan Socket.IO.", 11),
        ("", 10),
        ("FLOW SINGKAT", 14),
        ("User -> Flutter SDK -> POST /session -> SolidChat Server", 11),
        ("                         |", 11),
        ("                         +-> visitorToken otomatis", 11),
        ("                         +-> pre-chat form", 11),
        ("                         +-> chat realtime", 11),
    ],
    [
        ("KOMPONEN TOKEN", 16),
        ("visitorToken", 13),
        ("- Dibuat otomatis oleh server SolidChat.", 11),
        ("- Disimpan dan dipakai otomatis oleh SDK.", 11),
        ("- Dipakai untuk request chat dan Socket.IO.", 11),
        ("- User aplikasi tidak perlu membuat atau mengisi token.", 11),
        ("", 10),
        ("Yang tidak diperlukan", 14),
        ("- identityToken", 11),
        ("- CUSTOMER_IDENTITY_JWT_SECRET", 11),
        ("- CUSTOMER_IDENTITY_ISSUER", 11),
        ("- CUSTOMER_IDENTITY_AUDIENCE", 11),
        ("- endpoint token tambahan dari backend aplikasi", 11),
        ("", 10),
        ("PRE-CHAT", 14),
        ("User mengisi nama, email, dan nomor telepon sebelum chat.", 11),
        ("Data tersebut dikaitkan dengan conversation sebagai data visitor.", 11),
        ("Tidak ada verifikasi akun login dan tidak ada customer identity JWT.", 11),
        ("", 10),
        ("HASIL AKHIR", 14),
        ("- Integrasi cukup memasang SDK.", 11),
        ("- Tidak ada secret yang dibagikan ke aplikasi atau integrator.", 11),
        ("- Semua user tetap dapat memakai Live Chat.", 11),
        ("- Percakapan dianggap sebagai visitor, bukan akun login.", 11),
    ],
]


def esc(value: str) -> str:
    return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


objects = []
page_ids = []
font_id = 3

for lines in pages:
    stream = ["BT", "/F1 20 Tf", "72 750 Td"]
    first = True
    for text, size in lines:
        if not first:
            stream.append("0 -25 Td")
        stream.append(f"/F1 {size} Tf")
        stream.append(f"({esc(text)}) Tj")
        first = False
    stream.append("ET")
    data = "\n".join(stream).encode("latin-1")
    content_id = len(objects) + 4
    objects.append((content_id, f"<< /Length {len(data)} >>\nstream\n".encode("ascii") + data + b"\nendstream"))
    page_ids.append(len(objects) + 4)
    objects.append((page_ids[-1], b""))

catalog_id = 1
pages_id = 2
font_id = 3
max_id = max([catalog_id, pages_id, font_id] + [obj_id for obj_id, _ in objects])
page_index = 0
for index, (obj_id, body) in enumerate(objects):
    if body == b"":
        content_obj_id = objects[index - 1][0]
        body = f"<< /Type /Page /Parent {pages_id} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 {font_id} 0 R >> >> /Contents {content_obj_id} 0 R >>".encode("ascii")
        objects[index] = (obj_id, body)

page_refs = " ".join(f"{page_id} 0 R" for page_id in page_ids)
all_objects = [
    (catalog_id, f"<< /Type /Catalog /Pages {pages_id} 0 R >>".encode("ascii")),
    (pages_id, f"<< /Type /Pages /Kids [{page_refs}] /Count {len(page_ids)} >>".encode("ascii")),
    (font_id, b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"),
] + objects

pdf = bytearray(b"%PDF-1.4\n")
offsets = [0] * (max_id + 1)
for obj_id, body in all_objects:
    offsets[obj_id] = len(pdf)
    pdf.extend(f"{obj_id} 0 obj\n".encode("ascii"))
    pdf.extend(body)
    pdf.extend(b"\nendobj\n")
xref = len(pdf)
pdf.extend(f"xref\n0 {max_id + 1}\n".encode("ascii"))
pdf.extend(b"0000000000 65535 f \n")
for obj_id in range(1, max_id + 1):
    pdf.extend(f"{offsets[obj_id]:010d} 00000 n \n".encode("ascii"))
pdf.extend(f"trailer\n<< /Size {max_id + 1} /Root {catalog_id} 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode("ascii"))
OUT.write_bytes(pdf)
print(OUT)
