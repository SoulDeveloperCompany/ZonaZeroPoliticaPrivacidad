"""Une varias capturas en una sola imagen (para revisarlas de un vistazo con menos coste).
   python3 scripts/sheet.py salida.png captura1.png captura2.png ...  (ancho reducido al 60%)"""
import sys
from PIL import Image
out, *names = sys.argv[1:]
ims = [Image.open(n) for n in names]
ims = [i.resize((int(i.width * 0.6), int(i.height * 0.6))) for i in ims]
sheet = Image.new('RGB', (sum(i.width for i in ims) + 8 * (len(ims) - 1), max(i.height for i in ims)), 'white')
x = 0
for i in ims:
    sheet.paste(i, (x, 0)); x += i.width + 8
sheet.save(out)
print(out)
