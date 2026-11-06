"""Generates erd.svg / erd.png (run: python3 gen_erd.py; PNG needs cairosvg)."""
T={"categories":["PK category_id","name"],
"products":["PK product_id","sku","name","description","price","stock","image","FK category_id"],
"customers":["PK customer_id","full_name","phone","email","address"],
"orders":["PK order_id","order_no","FK customer_id","order_date","delivery_method","delivery_address","delivery_fee","status"],
"order_items":["PK order_item_id","FK order_id","FK product_id","quantity","unit_price"],
"payments":["PK payment_id","FK order_id","method","amount","status","paid_at"]}
P={"categories":(40,40),"products":(380,40),"customers":(760,40),"order_items":(380,420),"orders":(760,330),"payments":(760,640)}
W=230; H=lambda n:34+22*len(T[n])+8
b=[]; pos={}
for n,(x,y) in P.items():
    pos[n]=(x,y)
    b.append(f'<rect x="{x}" y="{y}" width="{W}" height="{H(n)}" rx="8" fill="#fff" stroke="#0f5c5c" stroke-width="2"/>'
             f'<path d="M{x} {y+34}V{y+8}a8 8 0 0 1 8-8H{x+W-8}a8 8 0 0 1 8 8V{y+34}Z" fill="#0f5c5c"/>'
             f'<text x="{x+W/2}" y="{y+23}" text-anchor="middle" fill="#fff" font-weight="700" font-size="15">{n}</text>')
    for i,c in enumerate(T[n]):
        tag=c[:2] if c[:2] in ("PK","FK") else ""; nm=c[3:] if tag else c
        col={"PK":"#b26a00","FK":"#1b5fa8"}.get(tag,"#12303a"); yy=y+34+22*(i+1)-6
        b.append(f'<text x="{x+12}" y="{yy}" font-size="12" font-weight="700" fill="{col}">{tag}</text>'
                 f'<text x="{x+44}" y="{yy}" font-size="13" fill="#12303a"{" font-weight=\"700\"" if tag=="PK" else ""}>{nm}</text>')
def rowy(n,col): return pos[n][1]+34+22*[c[3:] if c[:2] in("PK","FK") else c for c in T[n]].index(col)+11+22
def link(n1,c1,s1,n2,c2,s2,l1="1",l2="N",off=45):
    x1=pos[n1][0]+(W if s1=="r" else 0); y1=rowy(n1,c1)-22
    x2=pos[n2][0]+(W if s2=="r" else 0); y2=rowy(n2,c2)-22
    if s1==s2: mx=(x1-off) if s1=="l" else (x1+off)
    else: mx=(x1+x2)/2
    b.append(f'<path d="M{x1} {y1}H{mx}V{y2}H{x2}" fill="none" stroke="#567" stroke-width="2"/>')
    d=lambda s:14 if s=="r" else -14
    b.append(f'<text x="{x1+d(s1)}" y="{y1-6}" text-anchor="middle" font-size="14" font-weight="700">{l1}</text>'
             f'<text x="{x2+d(s2)}" y="{y2-6}" text-anchor="middle" font-size="14" font-weight="700">{l2}</text>')
link("categories","category_id","r","products","category_id","l")
link("customers","customer_id","l","orders","customer_id","l")
link("orders","order_id","l","order_items","order_id","r")
link("products","product_id","l","order_items","product_id","l")
link("orders","order_id","r","payments","order_id","r")
svg=(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1060 {640+H("payments")+30}" font-family="Trebuchet MS,Segoe UI,Arial,sans-serif">'
     '<rect width="100%" height="100%" fill="#f4f7f7"/><text x="40" y="26" font-size="18" font-weight="700" fill="#12303a">'
     'TechGear ERD (1 = one, N = many; PK primary key, FK foreign key)</text>'+"".join(b)+'</svg>')
open('erd.svg','w').write(svg)
try:
    import cairosvg; cairosvg.svg2png(url='erd.svg',write_to='erd.png',scale=1.2)
except ImportError: print("install cairosvg for erd.png")
