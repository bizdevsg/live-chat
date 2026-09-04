from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, KeepTogether, Image, Flowable
from reportlab.pdfgen import canvas
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "pdf" / "panduan-agent-solidchat.pdf"

INK = HexColor("#111827")
PANEL = HexColor("#1F2937")
PANEL_2 = HexColor("#273244")
GOLD = HexColor("#B99244")
MUTED = HexColor("#6B7280")
LINE = HexColor("#D9D9D9")
PALE = HexColor("#F8F6F1")
WHITE = colors.white
GREEN = HexColor("#198754")
AMBER = HexColor("#B7791F")
BLUE = HexColor("#2563EB")


def rounded(c, x, y, w, h, fill, radius=5, stroke=None, sw=1):
    c.setFillColor(fill)
    c.setStrokeColor(stroke or fill)
    c.setLineWidth(sw)
    c.roundRect(x, y, w, h, radius, fill=1, stroke=1 if stroke else 0)


def label(c, text, x, y, size=8, color=WHITE, font="Helvetica", max_width=None):
    c.setFillColor(color)
    c.setFont(font, size)
    if max_width and stringWidth(text, font, size) > max_width:
        while text and stringWidth(text + "...", font, size) > max_width:
            text = text[:-1]
        text += "..."
    c.drawString(x, y, text)


def login_mock(c, w, h):
    c.setFillColor(INK); c.rect(0, 0, w, h, fill=1, stroke=0)
    card_w, card_h = 220, 180
    x, y = (w-card_w)/2, (h-card_h)/2
    rounded(c, x, y, card_w, card_h, WHITE, 8)
    c.setFont("Helvetica-Bold", 15); c.setFillColor(GOLD); c.drawCentredString(w/2, y+145, "SolidChat AI")
    c.setFont("Helvetica", 7); c.setFillColor(MUTED); c.drawCentredString(w/2, y+130, "Dashboard Admin & CS - Solid Gold Berjangka")
    for offset, text in [(100, "Email"), (65, "Password")]:
        label(c, text, x+26, y+offset+14, 7, INK)
        rounded(c, x+25, y+offset-2, card_w-50, 18, HexColor("#F3F4F6"), 3, LINE)
    rounded(c, x+25, y+28, card_w-50, 24, GOLD, 4)
    c.setFont("Helvetica-Bold", 8); c.setFillColor(INK); c.drawCentredString(w/2, y+37, "Masuk")
    c.setFont("Helvetica", 7); c.setFillColor(MUTED); c.drawCentredString(w/2, y+12, "Lupa password?")


def inbox_mock(c, w, h):
    c.setFillColor(INK); c.rect(0, 0, w, h, fill=1, stroke=0)
    c.setFillColor(PANEL); c.rect(0, 0, 78, h, fill=1, stroke=0)
    c.setFont("Helvetica-Bold", 10); c.setFillColor(GOLD); c.drawString(13, h-24, "SC")
    label(c, "SolidChat", 13, h-38, 7, WHITE, "Helvetica-Bold")
    for i, item in enumerate(["Overview", "Inbox", "Tickets", "Customers"]):
        yy = h-66-i*25
        if item == "Inbox": rounded(c, 8, yy-7, 62, 19, HexColor("#3A3326"), 4)
        label(c, item, 16, yy, 7, GOLD if item == "Inbox" else HexColor("#C5CBD5"))
    c.setFillColor(PANEL); c.rect(78, h-36, w-78, 36, fill=1, stroke=0)
    label(c, "Inbox", 93, h-21, 11, WHITE, "Helvetica-Bold")
    rounded(c, w-105, h-27, 60, 16, HexColor("#31313A"), 4)
    label(c, "Offline", w-90, h-21, 7, WHITE, "Helvetica-Bold")
    c.setFillColor(HexColor("#202B3B")); c.rect(78, 0, 110, h-36, fill=1, stroke=0)
    label(c, "WAITING   N", 91, h-55, 7, GOLD, "Helvetica-Bold")
    for i, (name, stat) in enumerate([("Budi Santoso", "Menunggu agent"), ("Visitor anonim", "AI Aktif")]):
        yy = h-82-i*47
        rounded(c, 86, yy-28, 94, 38, PANEL, 3)
        label(c, name, 92, yy-2, 7, WHITE, "Helvetica-Bold", 78)
        label(c, stat, 92, yy-15, 6, HexColor("#F5C15C") if i == 0 else HexColor("#93C5FD"))
    c.setFillColor(INK); c.rect(188, 0, w-188, h-36, fill=1, stroke=0)
    label(c, "Budi Santoso", 202, h-57, 9, WHITE, "Helvetica-Bold")
    rounded(c, 202, h-89, 110, 30, HexColor("#374151"), 8); label(c, "Saya ingin tanya status", 211, h-75, 6.5, WHITE)
    rounded(c, 268, h-128, 116, 34, GOLD, 8); label(c, "Tentu, saya bantu cek.", 278, h-112, 6.5, INK)
    rounded(c, 202, 15, w-220, 24, PANEL_2, 4); label(c, "Tulis balasan...", 212, 25, 7, HexColor("#AEB7C3"))
    rounded(c, w-44, 15, 28, 24, GOLD, 4); label(c, "Kirim", w-39, 25, 5.5, INK, "Helvetica-Bold")


def action_mock(c, w, h):
    c.setFillColor(INK); c.rect(0, 0, w, h, fill=1, stroke=0)
    label(c, "Budi Santoso", 16, h-22, 12, WHITE, "Helvetica-Bold")
    rounded(c, 16, h-52, 42, 18, AMBER, 5); label(c, "Waiting", 22, h-45, 6, WHITE, "Helvetica-Bold")
    buttons=[("Accept", GOLD), ("Take Over", BLUE), ("Transfer", PANEL_2), ("Resolve", GREEN)]
    x=16
    for text, fill in buttons:
        bw=58 if text != "Take Over" else 70
        rounded(c, x, h-84, bw, 23, fill, 4)
        c.setFont("Helvetica-Bold", 6.5); c.setFillColor(INK if fill == GOLD else WHITE); c.drawCentredString(x+bw/2, h-75, text)
        x += bw+7
    rounded(c, 18, h-140, w-36, 36, HexColor("#173257"), 5, HexColor("#315580"))
    label(c, "AI Suggested Reply", 29, h-119, 7, HexColor("#A9CCFF"), "Helvetica-Bold")
    label(c, "Draf ini dapat diedit sebelum dikirim ke customer.", 29, h-131, 6.5, HexColor("#D6E7FF"))
    rounded(c, 18, 48, w-36, 36, PANEL_2, 5)
    label(c, "Internal note (tidak terlihat customer)...", 29, 67, 7, HexColor("#B9C0CA"))
    label(c, "Gunakan catatan internal untuk koordinasi antar-agent.", 29, 55, 6.5, HexColor("#778294"))


class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        canvas.Canvas.__init__(self, *args, **kwargs)
        self.pages=[]
    def showPage(self):
        self.pages.append(dict(self.__dict__))
        self._startPage()
    def save(self):
        count=len(self.pages)
        for state in self.pages:
            self.__dict__.update(state)
            if self._pageNumber > 1:
                self.setFont("Helvetica", 8); self.setFillColor(MUTED)
                self.drawRightString(A4[0]-18*mm, 13*mm, f"Panduan Agent SolidChat  |  {self._pageNumber} / {count}")
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    styles=getSampleStyleSheet()
    title=ParagraphStyle("title", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=28, leading=33, textColor=INK, alignment=TA_CENTER, spaceAfter=10)
    subtitle=ParagraphStyle("subtitle", parent=styles["Normal"], fontName="Helvetica", fontSize=12, leading=17, textColor=MUTED, alignment=TA_CENTER)
    h1=ParagraphStyle("h1", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=18, leading=23, textColor=INK, spaceBefore=3, spaceAfter=8)
    h2=ParagraphStyle("h2", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=12, leading=16, textColor=INK, spaceBefore=9, spaceAfter=4)
    body=ParagraphStyle("body", parent=styles["BodyText"], fontName="Helvetica", fontSize=9.5, leading=14, textColor=HexColor("#263142"), spaceAfter=6)
    small=ParagraphStyle("small", parent=body, fontSize=8, leading=11, textColor=MUTED)
    note=ParagraphStyle("note", parent=body, fontSize=8.5, leading=12, textColor=HexColor("#5B4520"))
    story=[]
    story += [Spacer(1, 45*mm), Paragraph("Panduan Agent SolidChat", title), Paragraph("Tutorial penggunaan dashboard dari login hingga chat dengan customer", subtitle), Spacer(1, 16*mm)]
    intro=Table([[Paragraph("Panduan ini membantu CS Agent menjalankan alur inti secara konsisten: masuk ke dashboard, mengambil percakapan, memberi respons yang tepat, berkoordinasi secara internal, lalu menyelesaikan percakapan.", body)]], colWidths=[145*mm])
    intro.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),PALE),("BOX",(0,0),(-1,-1),0.7,LINE),("LEFTPADDING",(0,0),(-1,-1),12),("RIGHTPADDING",(0,0),(-1,-1),12),("TOPPADDING",(0,0),(-1,-1),12),("BOTTOMPADDING",(0,0),(-1,-1),12)]))
    story += [intro, Spacer(1, 18*mm), Paragraph("Untuk CS Agent", subtitle), Spacer(1, 4*mm), Paragraph("Tampilan dan alur diverifikasi pada dashboard live", subtitle), PageBreak()]

    story += [Paragraph("1  Persiapan dan Login", h1), Paragraph("Tampilan login live menampilkan judul SolidChat AI serta kolom Email dan Password. Setelah berhasil masuk, dashboard membuka Beranda. Status agent tersedia di pojok kanan atas dan dapat dipilih sesuai kesiapan kerja.", body)]
    story += [ImageDrawing(login_mock, 160*mm, 105*mm), Spacer(1,4*mm), Paragraph("Gambar 1. Ilustrasi halaman login yang mengikuti dashboard live.", small)]
    steps=[["1", "Buka alamat dashboard yang diberikan admin."],["2", "Masukkan email dan password akun Anda."],["3", "Klik Masuk. Setelah berhasil, sistem membuka Beranda."],["4", "Pilih status agent di pojok kanan atas: Online untuk menerima chat, Busy saat kapasitas terbatas, atau Offline ketika tidak menerima chat baru."],["5", "Pilih Inbox dari menu navigasi untuk mulai menangani percakapan."]]
    t=Table([[Paragraph(f"<b>{a}</b>",body),Paragraph(b,body)] for a,b in steps], colWidths=[10*mm,150*mm])
    t.setStyle(TableStyle([("GRID",(0,0),(-1,-1),0.5,LINE),("BACKGROUND",(0,0),(0,-1),HexColor("#F6EFD9")),("VALIGN",(0,0),(-1,-1),"MIDDLE"),("LEFTPADDING",(0,0),(-1,-1),8),("RIGHTPADDING",(0,0),(-1,-1),8),("TOPPADDING",(0,0),(-1,-1),7),("BOTTOMPADDING",(0,0),(-1,-1),7)]))
    story += [Spacer(1,5*mm), t, PageBreak()]

    story += [Paragraph("2  Mengenal Inbox", h1), Paragraph("Inbox adalah pusat kerja agent. Tampilan live menyediakan tab Waiting dan My Chats. Angka pada setiap tab adalah jumlah percakapan saat itu sehingga nilainya dapat berubah. Saat layar sempit, navigasi utama dibuka melalui tombol menu di kiri atas.", body)]
    story += [ImageDrawing(inbox_mock, 160*mm, 105*mm), Spacer(1,4*mm), Paragraph("Gambar 2. Ilustrasi Inbox yang mengikuti struktur dashboard live: tab antrean, status AI Aktif, dan kolom balasan.", small)]
    story += [Paragraph("Cara memilih percakapan", h2), Paragraph("Pilih tab <b>Waiting</b> untuk melihat antrean yang dapat Anda tangani. Pilih nama customer untuk membuka detail chat. Tab <b>My Chats</b> memuat chat yang sudah Anda ambil. Label <b>AI Aktif</b> berarti percakapan masih ditangani asisten AI; gunakan Take Over ketika perlu dilanjutkan oleh manusia.", body), PageBreak()]

    story += [Paragraph("3  Mengambil dan Menangani Chat", h1), Paragraph("Tindakan yang tersedia bergantung pada status chat dan kepemilikan percakapan. Tombol balas baru aktif sesudah Anda mengambil chat atau mengambil alih percakapan dari AI.", body)]
    story += [ImageDrawing(action_mock, 160*mm, 92*mm), Spacer(1,4*mm), Paragraph("Gambar 3. Kontrol utama di detail percakapan.", small)]
    rows=[["Tindakan", "Kapan digunakan", "Hasil"],["Accept", "Chat berada di antrean Waiting.", "Chat menjadi milik Anda dan siap dibalas."],["Take Over", "AI masih aktif tetapi customer membutuhkan bantuan manusia.", "AI berhenti menangani chat dan Anda mengambil alih."],["Suggested Reply", "Anda memerlukan draf jawaban.", "AI menyiapkan draf yang tetap harus diperiksa dan diedit agent."],["Transfer", "Permintaan perlu ditangani tim lain.", "Chat dikirim ke tim tujuan."],["Resolve", "Masalah sudah selesai dan tidak ada tindak lanjut.", "Percakapan ditandai selesai."]]
    table=Table([[Paragraph(f"<b>{x}</b>",body) if r==0 else Paragraph(x,body) for x in row] for r,row in enumerate(rows)], colWidths=[31*mm,64*mm,65*mm])
    table.setStyle(TableStyle([("GRID",(0,0),(-1,-1),0.5,LINE),("BACKGROUND",(0,0),(-1,0),PANEL),("TEXTCOLOR",(0,0),(-1,0),WHITE),("VALIGN",(0,0),(-1,-1),"MIDDLE"),("LEFTPADDING",(0,0),(-1,-1),7),("RIGHTPADDING",(0,0),(-1,-1),7),("TOPPADDING",(0,0),(-1,-1),6),("BOTTOMPADDING",(0,0),(-1,-1),6)]))
    story += [Spacer(1,4*mm), table, PageBreak()]

    story += [Paragraph("4  Menulis Balasan yang Aman dan Jelas", h1), Paragraph("Setelah chat aktif di tangan Anda, tulis jawaban pada kolom Tulis balasan lalu klik Kirim. Gunakan bahasa yang sopan, jelas, dan langsung menjawab tujuan customer. Jika memakai Suggested Reply, verifikasi isi draf terlebih dahulu agar sesuai konteks percakapan.", body)]
    checklist=[["Periksa konteks", "Baca pesan terakhir dan ringkasan AI sebelum membalas."],["Jangan minta rahasia", "Jangan meminta password, PIN, OTP, atau data sensitif lain melalui chat."],["Pakai template", "Ketik shortcut template bila tersedia, lalu sesuaikan bahasanya sebelum mengirim."],["Catat koordinasi", "Pakai Internal note untuk informasi yang hanya boleh dibaca rekan agent."],["Eskalasikan", "Transfer atau buat Ticket bila masalah membutuhkan tim atau tindak lanjut lain."]]
    ct=Table([[Paragraph(f"<b>{a}</b>",body),Paragraph(b,body)] for a,b in checklist], colWidths=[43*mm,117*mm])
    ct.setStyle(TableStyle([("GRID",(0,0),(-1,-1),0.5,LINE),("BACKGROUND",(0,0),(0,-1),HexColor("#F6EFD9")),("VALIGN",(0,0),(-1,-1),"TOP"),("LEFTPADDING",(0,0),(-1,-1),8),("RIGHTPADDING",(0,0),(-1,-1),8),("TOPPADDING",(0,0),(-1,-1),8),("BOTTOMPADDING",(0,0),(-1,-1),8)]))
    story += [ct, Spacer(1,8*mm), Paragraph("Contoh alur respons", h2), Paragraph("Customer: “Saya ingin mengetahui status permintaan saya.”<br/><b>Agent:</b> “Baik, saya bantu cek. Mohon tunggu sebentar, saya akan meninjau data permintaan Anda terlebih dahulu.”<br/><br/>Jika membutuhkan pemeriksaan lintas tim, tambahkan internal note yang ringkas dan transfer chat ke tim terkait. Beri tahu customer bahwa permintaannya sedang diteruskan bila hal itu relevan.", body), PageBreak()]

    story += [Paragraph("5  Menutup Percakapan dan Tindak Lanjut", h1), Paragraph("Klik Resolve hanya setelah pertanyaan customer selesai dijawab atau tindak lanjut telah dialihkan dengan jelas. Percakapan yang selesai dapat dibuka kembali jika customer mengirim pesan lanjutan atau informasi baru memerlukan penanganan. Jangan mengubah status agent hanya untuk melihat antarmuka; pilih status berdasarkan kesiapan menangani chat.", body)]
    flow=Table([[Paragraph("Customer membutuhkan bantuan", body), Paragraph("Agent Accept atau Take Over", body), Paragraph("Balas dan koordinasikan", body), Paragraph("Resolve atau Transfer", body)]], colWidths=[40*mm]*4)
    flow.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),HexColor("#F6EFD9")),("GRID",(0,0),(-1,-1),0.5,LINE),("VALIGN",(0,0),(-1,-1),"MIDDLE"),("ALIGN",(0,0),(-1,-1),"CENTER"),("LEFTPADDING",(0,0),(-1,-1),7),("RIGHTPADDING",(0,0),(-1,-1),7),("TOPPADDING",(0,0),(-1,-1),13),("BOTTOMPADDING",(0,0),(-1,-1),13)]))
    story += [Spacer(1,8*mm),flow,Spacer(1,12*mm),Paragraph("Ringkasan cepat",h2),Paragraph("1. Login dan atur status Online.  2. Buka Inbox dan pilih chat Waiting.  3. Klik Accept atau Take Over.  4. Baca konteks, tulis respons, dan gunakan internal note bila perlu.  5. Transfer jika perlu tim lain, atau Resolve ketika selesai.",body),Spacer(1,10*mm),Paragraph("Jika tombol atau menu tidak muncul, kemungkinan peran akun Anda belum memiliki izin yang diperlukan. Hubungi supervisor atau administrator untuk bantuan akses.",note)]

    doc=BaseDocTemplate(str(OUT), pagesize=A4, leftMargin=25*mm, rightMargin=25*mm, topMargin=21*mm, bottomMargin=20*mm)
    frame=Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="main")
    doc.addPageTemplates([PageTemplate(id="main", frames=[frame])])
    doc.build(story, canvasmaker=NumberedCanvas)
    print(OUT)


class ImageDrawing(Flowable):
    def __init__(self, drawfn, width, height):
        Flowable.__init__(self)
        self.drawfn, self.width, self.height = drawfn, width, height
    def wrap(self, availWidth, availHeight): return self.width, self.height
    def drawOn(self, canv, x, y, _sW=0):
        canv.saveState(); canv.translate(x, y); self.drawfn(canv, self.width, self.height); canv.restoreState()


if __name__ == "__main__": main()
