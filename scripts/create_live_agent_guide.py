from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, Flowable
from reportlab.pdfgen import canvas
from reportlab.lib.enums import TA_CENTER

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output'/'pdf'/'panduan-operasional-agent-solidchat.pdf'
INK=HexColor('#111214'); PANEL=HexColor('#18191D'); PANEL2=HexColor('#202127'); GOLD=HexColor('#D2AB39'); TEXT=HexColor('#F4F4F5'); MUTED=HexColor('#94949E'); LINE=HexColor('#34343B'); BLUE=HexColor('#19316F'); RED=HexColor('#7C252D'); AMBER=HexColor('#402817')

def box(c,x,y,w,h,fill,r=4,stroke=None):
 c.setFillColor(fill); c.setStrokeColor(stroke or fill); c.roundRect(x,y,w,h,r,fill=1,stroke=bool(stroke))
def t(c,s,x,y,size=7,col=TEXT,bold=False):
 c.setFont('Helvetica-Bold' if bold else 'Helvetica',size); c.setFillColor(col); c.drawString(x,y,s)
def pill(c,s,x,y,w,fill,col=TEXT): box(c,x,y,w,13,fill,7); c.setFont('Helvetica-Bold',5.8); c.setFillColor(col); c.drawCentredString(x+w/2,y+4.2,s)

def live_inbox(c,w,h):
 c.setFillColor(INK);c.rect(0,0,w,h,fill=1,stroke=0)
 # real three-column dashboard reference, anonymised
 c.setFillColor(PANEL);c.rect(0,0,66,h,fill=1,stroke=0); c.setStrokeColor(LINE);c.line(66,0,66,h);c.line(206,0,206,h)
 box(c,12,h-28,22,22,HexColor('#332c17'),7,HexColor('#574b26'));t(c,'SC',17,h-20,8,GOLD,True);t(c,'SOLIDCHAT',39,h-15,6.5,TEXT,True);t(c,'ADMIN PANEL',39,h-24,4.5,GOLD,True)
 t(c,'BERANDA',12,h-45,4.8,GOLD,True);box(c,7,h-69,52,19,HexColor('#201f19'),6,HexColor('#4E421B'));t(c,'Inbox',22,h-61,6.4,TEXT);pill(c,'16',47,h-65,9,GOLD,INK)
 t(c,'MENU',12,h-88,4.8,GOLD,True);t(c,'Tickets',22,h-105,6,MUTED);t(c,'Customers',22,h-122,6,MUTED)
 box(c,6,7,54,22,PANEL2,5,LINE);box(c,10,10,17,17,HexColor('#332c17'),5);t(c,'CA',14,16,6,GOLD,True);t(c,'Canka Monita',30,20,5.8,TEXT,True);t(c,'agent@email.com',30,13,4.5,MUTED)
 # queue
 t(c,'WAITING',80,h-17,6,GOLD,True);pill(c,'16',111,h-21,9,HexColor('#423918'),GOLD);t(c,'MY CHATS',147,h-17,6,MUTED,True);pill(c,'0',187,h-21,8,PANEL2,MUTED);c.setStrokeColor(GOLD);c.line(78,h-26,132,h-26)
 people=[('Visitor anonim','GENERAL_INQUIRY','AI Aktif'),('Budi','Belum diklasifikasi','AI Aktif'),('Budi','Belum diklasifikasi','Ditutup'),('Anita','GENERAL_INQUIRY','Ditutup')]
 for i,(name,topic,state) in enumerate(people):
  yy=h-43-i*36
  if i==2: c.setFillColor(PANEL2);c.rect(67,yy-28,139,34,fill=1,stroke=0)
  t(c,name,74,yy-5,6.4,TEXT,True);t(c,topic,74,yy-13,4.4,MUTED);t(c,'4/9/2026, 08.24',74,yy-21,4.2,MUTED)
  pill(c,state,174,yy-11,24, BLUE if state=='AI Aktif' else RED)
 # conversation center / right
 pill(c,'CLOSED',218,h-21,29,HexColor('#4A3B12'),GOLD);pill(c,'AI',251,h-21,12,BLUE);box(c,340,h-23,31,16,PANEL2,4,LINE);t(c,'Transfer',344,h-17,5.3,TEXT,True);box(c,376,h-23,37,16,PANEL2,4,LINE);t(c,'Buat Ticket',380,h-17,5.2,TEXT,True)
 box(c,218,h-70,135,31,BLUE,7,HexColor('#3152B5'));t(c,'AI',225,h-49,4.5,HexColor('#A7BDF8'));t(c,'Selamat datang di Customer Service SGB.',225,h-57,5.7,TEXT);t(c,'Silakan sampaikan kebutuhan Anda.',225,h-65,5.7,TEXT)
 box(c,216,70,197,15,AMBER,5,HexColor('#68451E'));t(c,'Conversation ini sudah di-close dan tidak bisa dibuka lagi.',222,75,5.1,GOLD)
 t(c,'Suggested Reply',218,58,5.7,MUTED,True);t(c,'Ketik /shortcut untuk memakai template.',272,58,5.2,MUTED);box(c,216,31,164,20,HexColor('#151619'),4,HexColor('#25262B'));t(c,'Accept chat dulu sebelum membalas...',222,39,5.4,HexColor('#5F6069'));box(c,383,31,29,20,HexColor('#6A571B'),4);t(c,'Kirim',389,39,5.2,GOLD,True)
 t(c,'CUSTOMER',216,19,4.7,MUTED,True);t(c,'Budi',216,11,5.7,TEXT);t(c,'RINGKASAN AI',302,19,4.7,MUTED,True);t(c,'Belum ada ringkasan.',302,11,5.5,MUTED)

class Draw(Flowable):
 def __init__(self,fn,w,h): super().__init__();self.fn,self.width,self.height=fn,w,h
 def wrap(self,a,b): return self.width,self.height
 def drawOn(self,c,x,y,_sW=0): c.saveState();c.translate(x,y);self.fn(c,self.width,self.height);c.restoreState()
class NumCanvas(canvas.Canvas):
 def __init__(self,*a,**kw):super().__init__(*a,**kw);self.pages=[]
 def showPage(self):self.pages.append(dict(self.__dict__));self._startPage()
 def save(self):
  for i,s in enumerate(self.pages,1):
   self.__dict__.update(s)
   if i>1:self.setFillColor(MUTED);self.setFont('Helvetica',8);self.drawRightString(A4[0]-18*mm,13*mm,f'Panduan Operasional Agent | {i}/{len(self.pages)}')
   canvas.Canvas.showPage(self)
  canvas.Canvas.save(self)

def main():
 OUT.parent.mkdir(parents=True,exist_ok=True)
 st=getSampleStyleSheet(); title=ParagraphStyle('T',parent=st['Title'],fontName='Helvetica-Bold',fontSize=29,leading=34,textColor=HexColor('#101827'),alignment=TA_CENTER); sub=ParagraphStyle('S',parent=st['Normal'],fontSize=11,leading=15,textColor=HexColor('#6B7280'),alignment=TA_CENTER); h=ParagraphStyle('H',parent=st['Heading1'],fontName='Helvetica-Bold',fontSize=18,leading=22,textColor=HexColor('#101827'),spaceAfter=7); b=ParagraphStyle('B',parent=st['BodyText'],fontSize=9.5,leading=14,textColor=HexColor('#273246'),spaceAfter=7); cap=ParagraphStyle('C',parent=b,fontSize=8,leading=11,textColor=HexColor('#6B7280'))
 s=[]
 s += [Spacer(1,48*mm),Paragraph('Panduan Operasional Agent',title),Paragraph('SolidChat AI - dari masuk dashboard sampai menyelesaikan chat',sub),Spacer(1,20*mm),Paragraph('Panduan kerja singkat untuk agent Customer Service. Susunan menu, status, dan area Inbox pada dokumen ini disusun ulang dari dashboard live agar setiap langkah mudah diikuti tanpa mengubah data customer.',b),Spacer(1,18*mm),Paragraph('Alur inti: Login  →  Tentukan status  →  Buka Inbox  →  Ambil chat  →  Balas atau eskalasi  →  Selesaikan',sub),PageBreak()]
 s += [Paragraph('1  Masuk dan siap menerima chat',h),Paragraph('Masuk menggunakan akun agent. Beranda akan tampil setelah autentikasi berhasil. Di area atas terdapat pilihan status <b>Online</b>, <b>Busy</b>, dan <b>Offline</b>. Pilih Online hanya ketika siap menerima percakapan baru; Busy saat kapasitas terbatas; dan Offline ketika tidak bertugas.',b),Draw(live_inbox,160*mm,88*mm),Paragraph('Gambar 1. Tampilan dashboard live yang direkonstruksi dan dianonimkan. Navigasi kiri memuat Inbox, Tickets, dan Customers.',cap),Spacer(1,5*mm),Paragraph('Langkah cepat',h),Paragraph('<b>1.</b> Tekan menu Inbox. <b>2.</b> Buka tab Waiting. <b>3.</b> Pilih percakapan yang akan ditangani. Angka di badge adalah jumlah chat pada saat itu dan dapat berubah.',b),PageBreak()]
 s += [Paragraph('2  Membaca Inbox dan status chat',h),Paragraph('Inbox menggunakan tiga area: menu navigasi di kiri, daftar Waiting atau My Chats di tengah, dan detail percakapan di kanan. Label biru <b>AI Aktif</b> menunjukkan AI masih menangani percakapan. Label merah <b>Ditutup</b> menunjukkan chat tidak dapat dibalas lagi.',b),Draw(live_inbox,160*mm,88*mm),Paragraph('Gambar 2. Struktur Inbox desktop: antrean, status percakapan, bubble pesan, kolom respons, dan informasi customer.',cap),Spacer(1,5*mm)]
 rows=[['Status','Makna','Tindakan agent'],['AI Aktif','AI sedang merespons customer.','Baca konteks; gunakan Take Over jika perlu intervensi manusia.'],['Waiting','Customer menunggu agent.','Klik Accept sebelum mengetik balasan.'],['Ditutup','Percakapan telah selesai.','Tidak dapat dibalas; gunakan sebagai referensi saja.']]
 tb=Table([[Paragraph(f'<b>{x}</b>',b) if r==0 else Paragraph(x,b) for x in row] for r,row in enumerate(rows)],colWidths=[31*mm,49*mm,80*mm]);tb.setStyle(TableStyle([('GRID',(0,0),(-1,-1),.5,HexColor('#D6D9DE')),('BACKGROUND',(0,0),(-1,0),HexColor('#1F2937')),('TEXTCOLOR',(0,0),(-1,0),colors.white),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6)]));s += [tb,PageBreak()]
 s += [Paragraph('3  Mengambil alih dan membalas',h),Paragraph('Pilih detail percakapan lalu gunakan tindakan sesuai kondisinya. Tombol balas terkunci sampai agent berhak menangani chat. Jangan kirim Suggested Reply tanpa membaca ulang; itu adalah draf, bukan jawaban final.',b)]
 actions=[['Accept','Mengambil chat Waiting agar menjadi tanggung jawab Anda.'],['Take Over','Memindahkan penanganan dari AI ke agent manusia.'],['Suggested Reply','Meminta draf jawaban yang harus diedit dan diverifikasi.'],['Transfer','Mengirim chat ke tim yang sesuai.'],['Buat Ticket','Mencatat tindak lanjut yang tidak dapat selesai di chat.'],['Resolve','Menandai percakapan selesai setelah kebutuhan customer tertangani.']]
 at=Table([[Paragraph(f'<b>{a}</b>',b),Paragraph(c,b)] for a,c in actions],colWidths=[42*mm,118*mm]);at.setStyle(TableStyle([('GRID',(0,0),(-1,-1),.5,HexColor('#D6D9DE')),('BACKGROUND',(0,0),(0,-1),HexColor('#F6EFD9')),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('LEFTPADDING',(0,0),(-1,-1),8),('RIGHTPADDING',(0,0),(-1,-1),8),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7)]));s += [at,Spacer(1,8*mm),Paragraph('Urutan aman sebelum kirim',h),Paragraph('Baca pesan terakhir dan Ringkasan AI. Pastikan nama, permintaan, dan jawaban sesuai konteks. Gunakan template dengan mengetik <b>/shortcut</b> bila tersedia, lalu sesuaikan. Jangan meminta password, PIN, OTP, atau data rahasia melalui chat.',b),PageBreak()]
 s += [Paragraph('4  Koordinasi dan penyelesaian',h),Paragraph('<b>Internal note</b> dipakai untuk koordinasi antar-agent dan tidak terlihat customer. Bila permintaan perlu tim lain, gunakan Transfer dan informasikan customer dengan kalimat singkat. Gunakan Buat Ticket untuk pekerjaan yang perlu ditindaklanjuti di luar percakapan.',b),Spacer(1,6*mm),Paragraph('Contoh respons',h),Paragraph('<b>Customer:</b> “Saya ingin mengetahui status permintaan saya.”<br/><b>Agent:</b> “Baik, saya bantu cek terlebih dahulu. Mohon tunggu sebentar, saya akan meninjau informasi yang tersedia.”',b),Spacer(1,7*mm),Paragraph('Sebelum klik Resolve',h),Paragraph('Pastikan pertanyaan telah dijawab, customer memahami tindak lanjutnya, dan catatan internal atau ticket sudah dibuat bila diperlukan. Chat yang Ditutup tidak dapat dibuka kembali dari area balasan, sehingga pastikan tidak ada pekerjaan penting yang terlewat.',b),Spacer(1,10*mm),Paragraph('Checklist akhir',h)]
 check=[['✓','Status agent sesuai kesiapan kerja.'],['✓','Chat sudah di-Accept atau di-Take Over sebelum dibalas.'],['✓','Balasan tidak berisi data rahasia atau janji yang belum terverifikasi.'],['✓','Transfer, internal note, atau ticket dibuat bila dibutuhkan.'],['✓','Resolve hanya dilakukan saat masalah benar-benar selesai.']]
 ct=Table([[Paragraph(a,b),Paragraph(c,b)] for a,c in check],colWidths=[11*mm,149*mm]);ct.setStyle(TableStyle([('GRID',(0,0),(-1,-1),.5,HexColor('#D6D9DE')),('BACKGROUND',(0,0),(0,-1),HexColor('#F6EFD9')),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('LEFTPADDING',(0,0),(-1,-1),8),('RIGHTPADDING',(0,0),(-1,-1),8),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6)]));s += [ct]
 doc=BaseDocTemplate(str(OUT),pagesize=A4,leftMargin=25*mm,rightMargin=25*mm,topMargin=21*mm,bottomMargin=20*mm);doc.addPageTemplates([PageTemplate(id='p',frames=[Frame(doc.leftMargin,doc.bottomMargin,doc.width,doc.height,id='f')])]);doc.build(s,canvasmaker=NumCanvas);print(OUT)
if __name__=='__main__':main()
