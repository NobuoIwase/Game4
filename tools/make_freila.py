#!/usr/bin/env python3
"""フレイラ(火の天使)のスプライトを手続きで描く。
出力: assets/sprites/freila.png (35x52 ドット) / assets/sprites/freila_hd.png (160x240) / assets/ref/freila_stand.png (ADV立ち絵 480x720)
参考: 赤い短髪(ボブ)・光輪・白い翼と白いマント・赤い衣に金の縁と胸のリボン・赤いブーツ。
assets/ref/freila.png(手描き原画)があれば、そちらを立ち絵に優先して使う(ui.js 側)。"""
from PIL import Image, ImageDraw, ImageFilter
import os
W,H=640,960   # 作業解像度(160x240 の4倍)
def draw(scale=1.0):
    im=Image.new('RGBA',(W,H),(0,0,0,0)); d=ImageDraw.Draw(im)
    S=lambda v:int(v*4)
    HAIR,HAIR_D,HAIR_L='#c8434a','#8f2a33','#e06a6e'
    SKIN,SKIN_S='#f7dcc0','#e8b99a'
    RED,RED_D,RED_L='#d94040','#a52a2a','#ef6a5a'
    GOLD,GOLD_D='#f2c14e','#c48f22'
    WING,WING_S='#f6f1ea','#cfc6dc'
    BOOT,BOOT_D='#b8323a','#7d1f26'
    EYE='#2b1a1a'; OUT='#3a1a22'
    # 翼(背後)
    for sx in (-1,1):
        cx=80+sx*48; 
        d.polygon([(S(cx),S(95)),(S(cx+sx*34),S(70)),(S(cx+sx*44),S(92)),(S(cx+sx*40),S(118)),(S(cx+sx*18),S(132)),(S(cx+sx*4),S(115))],fill=WING,outline=OUT)
        d.polygon([(S(cx+sx*6),S(100)),(S(cx+sx*30),S(84)),(S(cx+sx*34),S(104)),(S(cx+sx*20),S(120))],fill=WING_S)
        d.line([(S(cx+sx*10),S(106)),(S(cx+sx*36),S(90))],fill=WING_S,width=S(1.2))
    # マント(白、脚の後ろに広がる)
    d.polygon([(S(56),S(120)),(S(104),S(120)),(S(138),S(215)),(S(112),S(224)),(S(80),S(208)),(S(48),S(224)),(S(22),S(215))],fill=WING,outline=OUT)
    d.polygon([(S(62),S(124)),(S(98),S(124)),(S(118),S(206)),(S(80),S(196)),(S(42),S(206))],fill=WING_S)
    # 脚とブーツ
    for sx in (-1,1):
        x=80+sx*11
        d.rectangle([S(x-6),S(160),S(x+6),S(186)],fill=SKIN,outline=OUT)
        d.rounded_rectangle([S(x-8),S(184),S(x+8),S(228)],radius=S(4),fill=BOOT,outline=OUT)
        d.line([(S(x-6),S(190)),(S(x+6),S(190))],fill=GOLD,width=S(1.5))
        d.rectangle([S(x-9),S(222),S(x+9),S(230)],fill=BOOT_D,outline=OUT)
    # スカート(赤・フレア、金の縁、前のスリット)
    d.polygon([(S(58),S(118)),(S(102),S(118)),(S(122),S(182)),(S(80),S(176)),(S(38),S(182))],fill=RED,outline=OUT)
    d.polygon([(S(64),S(120)),(S(96),S(120)),(S(110),S(176)),(S(80),S(170)),(S(50),S(176))],fill=RED_L)
    d.line([(S(40),S(180)),(S(80),S(174)),(S(120),S(180))],fill=GOLD,width=S(2))
    d.polygon([(S(74),S(150)),(S(86),S(150)),(S(88),S(178)),(S(72),S(178))],fill=RED_D)
    d.line([(S(80),S(126)),(S(80),S(176))],fill=GOLD_D,width=S(1.2))
    # 胴(赤の身頃)
    d.rounded_rectangle([S(60),S(96),S(100),S(124)],radius=S(6),fill=RED,outline=OUT)
    d.rectangle([S(66),S(100),S(94),S(122)],fill=RED_L)
    # 袖(パフ)と腕
    for sx in (-1,1):
        x=80+sx*26
        d.ellipse([S(x-10),S(96),S(x+10),S(116)],fill=RED,outline=OUT)
        d.line([(S(x-7),S(112)),(S(x+7),S(112))],fill=GOLD,width=S(1.5))
        d.rounded_rectangle([S(x+sx*2-5),S(112),S(x+sx*2+5),S(150)],radius=S(4),fill=SKIN,outline=OUT)
        d.ellipse([S(x+sx*4-6),S(146),S(x+sx*4+6),S(158)],fill=SKIN,outline=OUT)
    # 胸のリボン(金)
    d.polygon([(S(80),S(106)),(S(68),S(100)),(S(68),S(112))],fill=GOLD,outline=GOLD_D)
    d.polygon([(S(80),S(106)),(S(92),S(100)),(S(92),S(112))],fill=GOLD,outline=GOLD_D)
    d.ellipse([S(76),S(102),S(84),S(110)],fill=GOLD_D)
    # 首まわりの白襟
    d.ellipse([S(64),S(88),S(96),S(102)],fill=WING,outline=OUT)
    # 頭(大きめ)
    d.ellipse([S(44),S(30),S(116),S(100)],fill=SKIN,outline=OUT)
    # 髪(赤いボブ): 頭を覆い、両サイドは顎まで
    d.ellipse([S(40),S(22),S(120),S(84)],fill=HAIR,outline=OUT)
    d.polygon([(S(40),S(52)),(S(38),S(96)),(S(52),S(98)),(S(56),S(70))],fill=HAIR,outline=OUT)
    d.polygon([(S(120),S(52)),(S(122),S(96)),(S(108),S(98)),(S(104),S(70))],fill=HAIR,outline=OUT)
    # 前髪(ぎざぎざ)
    d.polygon([(S(44),S(58)),(S(52),S(72)),(S(60),S(56)),(S(68),S(74)),(S(76),S(54)),(S(84),S(74)),(S(92),S(56)),(S(100),S(72)),(S(108),S(56)),(S(116),S(60)),(S(116),S(40)),(S(44),S(40))],fill=HAIR,outline=OUT)
    d.arc([S(48),S(26),S(112),S(70)],200,340,fill=HAIR_L,width=S(3))
    # 顔: 目・頬・口
    for sx in (-1,1):
        x=80+sx*14
        d.rounded_rectangle([S(x-5),S(66),S(x+5),S(84)],radius=S(3),fill=EYE)
        d.ellipse([S(x-2),S(69),S(x+1),S(73)],fill='#fff')
        d.ellipse([S(x+sx*4-6),S(84),S(x+sx*4+6),S(90)],fill=(255,140,150,150))
    d.arc([S(74),S(82),S(86),S(92)],20,160,fill=OUT,width=S(1.5))
    # 光輪
    d.ellipse([S(52),S(8),S(108),S(26)],outline=GOLD,width=S(4))
    d.ellipse([S(56),S(11),S(104),S(23)],outline='#fff1b0',width=S(1.5))
    return im
im=draw()
os.makedirs('assets/sprites',exist_ok=True); os.makedirs('assets/ref',exist_ok=True)
hd=im.resize((160,240),Image.LANCZOS); hd.save('assets/sprites/freila_hd.png')
px=im.resize((35,52),Image.BOX)
# ドット絵らしく: 半透明を潰す
px=px.convert('RGBA'); pd=px.load()
for y in range(px.height):
    for x in range(px.width):
        r,g,b,a=pd[x,y]; pd[x,y]=(r,g,b,255 if a>110 else 0)
px.save('assets/sprites/freila.png')
stand=im.resize((480,720),Image.LANCZOS); stand.save('assets/ref/freila_stand.png')
print('ok', hd.size, px.size, stand.size)
