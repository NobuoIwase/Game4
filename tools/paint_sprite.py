#!/usr/bin/env python3
"""tools/paint_sprite.py — 描き込み版ルミナ(lumina_hd.png)を原画から焼く。
4倍解像度(既定240px高)の柔らかい原本に、左上のリムライト・右下の陰(AO)・0.75px相当の青みの縁取り・
金色の色止め(光輪/十字/足環)・瞳の濃紫化+キャッチライト・足元へ沈む地明かりを焼き込む。
使い方: python3 tools/paint_sprite.py assets/ref/lumina_novelai.png assets/sprites/lumina_hd.png 240
"""
import sys
from PIL import Image, ImageFilter, ImageChops
SRC=sys.argv[1] if len(sys.argv)>1 else 'assets/ref/lumina_novelai.png'
DST=sys.argv[2] if len(sys.argv)>2 else 'assets/sprites/lumina_hd.png'
H=int(sys.argv[3]) if len(sys.argv)>3 else 240          # 原本の高さ(ゲーム内60px→4倍)
D=max(2,round(H/60))                                     # 論理1pxが原本で何px(=4)
im=Image.open(SRC).convert('RGBA'); im=im.crop(im.getchannel('A').getbbox())
w=round(im.width*H/im.height)
im=im.convert('RGBa').resize((w,H),Image.LANCZOS).convert('RGBA')        # 事前乗算で縮小: 暗いフリンジを出さない
a=im.getchannel('A').point(lambda v:0 if v<28 else v)                     # アンチエイリアスは残し、もやだけ落とす
rgb=im.convert('RGB').filter(ImageFilter.UnsharpMask(radius=1.2,percent=60,threshold=2))
px=rgb.load(); al=a.load()
# --- 金色の色止め(光輪・十字・足環): 陰影や縁取りで灰色に沈まないように
GOLD=(255,214,120)
for y in range(H):
    for x in range(w):
        if al[x,y] and px[x,y][0]-px[x,y][2]>40 and px[x,y][1]>170:
            px[x,y]=tuple(int(c*0.7+gc*0.3) for c,gc in zip(px[x,y],GOLD))
# --- 瞳: 顔の範囲の最も暗い画素を濃紫へ、各瞳に一点のキャッチライト
x0,x1,y0,y1=int(w*0.3),int(w*0.7),int(H*0.2),int(H*0.5)
lum=lambda c:0.299*c[0]+0.587*c[1]+0.114*c[2]
eye={(x,y) for y in range(y0,y1) for x in range(x0,x1) if al[x,y] and lum(px[x,y])<120}
for (x,y) in eye:
    r,g,b=px[x,y]; px[x,y]=(int(r*0.45+50*0.55),int(g*0.45+34*0.55),int(b*0.45+70*0.55))
seen=set()
for p in sorted(eye):
    if p in seen: continue
    comp=[]; st=[p]
    while st:
        c=st.pop()
        if c in seen or c not in eye: continue
        seen.add(c); comp.append(c); st+=[(c[0]+1,c[1]),(c[0]-1,c[1]),(c[0],c[1]+1),(c[0],c[1]-1)]
    if len(comp)<D*D*4: continue                          # 髪の影の欠片は無視
    hx=min(c[0] for c in comp); hy=min(c[1] for c in comp)
    cx,cy=hx+D//2+1, hy+D//2+1
    for dy in range(-(D//2),D//2+1):
        for dx in range(-(D//2),D//2+1):
            if (cx+dx,cy+dy) in eye: px[cx+dx,cy+dy]=(240,232,255)
im=rgb.convert('RGBA'); im.putalpha(a)
# --- 焼き込みの光: 左上のリム(論理1px・暖色)と右下の陰の帯(紫)
solid=a.point(lambda v:255 if v>60 else 0)
rim=ImageChops.subtract(solid,ImageChops.offset(solid,D,D)).point(lambda v:int(v*0.55))
lit=Image.new('RGBA',im.size,(255,244,225,0)); lit.putalpha(rim); im=Image.alpha_composite(im,lit)
ao=ImageChops.subtract(solid,ImageChops.offset(solid,-D,-D)).point(lambda v:int(v*0.45))
dk=Image.new('RGBA',im.size,(70,40,90,0)); dk.putalpha(ao); im=Image.alpha_composite(im,dk)
# --- 地明かり: 下45%が紫へ沈む(本体の内側だけ、0→0.18)
grad=Image.new('L',(1,H)); gp=grad.load()
for y in range(H): gp[0,y]=int(max(0,(y/H-0.55)/0.45)*0.18*255)
grad=ImageChops.multiply(grad.resize((w,H)),a)
gd=Image.new('RGBA',im.size,(60,40,90,0)); gd.putalpha(grad); im=Image.alpha_composite(im,gd)
# --- 柔らかい縁取りを下に敷く: 原本3px(論理0.75px)膨張、青み、α0.85
ol=solid.filter(ImageFilter.MaxFilter(2*(D-1)+1)).point(lambda v:217 if v>60 else 0)
out=Image.new('RGBA',im.size,(46,30,64,255)); out.putalpha(ol); out=Image.alpha_composite(out,im)
out.save(DST)
pxs=[c for c in out.getdata() if c[3]>0]
print(DST,out.size,'meanL',round(sum(lum(c) for c in pxs)/len(pxs),1),'eye px',len(eye))
