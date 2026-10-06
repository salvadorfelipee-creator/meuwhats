import csv, html
E=html.escape
def rows(f): return list(csv.DictReader(open('upload/'+f,encoding='utf-8-sig')))
ads=[r for r in rows('04-anuncios.csv') if 'Harmoniza' not in r['Campaign']]
ads+= rows('04c-harmonizacao-novo-anuncio.csv')
order=['ESP - Urgência','ESP - Implante e Prótese','ESP - Ortodontia','ESP - Odontopediatria','ESP - Clareamento e Lentes','ESP - Harmonização Facial','ESP - Dentista em Brusque e Família']
nice={'ESP - Urgência':'Urgência','ESP - Implante e Prótese':'Implante e prótese','ESP - Ortodontia':'Ortodontia','ESP - Odontopediatria':'Dentista infantil','ESP - Clareamento e Lentes':'Clareamento e lentes','ESP - Harmonização Facial':'Harmonização facial','ESP - Dentista em Brusque e Família':'Dentista em Brusque e família'}
budget={'ESP - Urgência':15,'ESP - Implante e Prótese':20,'ESP - Ortodontia':10,'ESP - Odontopediatria':8,'ESP - Clareamento e Lentes':7,'ESP - Harmonização Facial':10,'ESP - Dentista em Brusque e Família':10}
query={'Dente quebrado':'dente quebrado dentista brusque','Dor de dente':'dentista dor de dente brusque','Implante dentário':'implante dentário brusque','Prótese protocolo':'prótese protocolo brusque','Alinhador invisível':'alinhador invisível brusque','Aparelho fixo':'aparelho ortodôntico brusque','Dentista infantil':'dentista infantil brusque','Clareamento dental':'clareamento dental brusque','Lente de contato dental':'lente de contato dental brusque','Harmonização e preenchimento':'harmonização facial brusque','Dentista em Brusque':'dentista em brusque','Família e convênio':'dentista para família brusque'}
sl=[('Encaixe de urgência','Dente quebrado ou dor de dente'),('Implante dentário','Avaliação com planejamento'),('Ortodontia e alinhador','Aparelho fixo ou invisível'),('Como chegar','Rua Sete de Setembro, 55')]
def phone(r):
    hs=[r['Headline %d'%i] for i in range(1,16) if r['Headline %d'%i]]
    ds=[r['Description %d'%i] for i in range(1,5) if r['Description %d'%i]]
    title=' | '.join([hs[0],hs[1],hs[2]])
    others=[h for h in hs[3:] if not h.startswith('Dra. Catiucia')]
    q=query[r['Ad group']]
    p1,p2=r['Path 1'],r['Path 2']
    url='clinicaespecita.com › '+p1+' › '+p2
    sls=''.join('<li><a>%s</a><span>%s</span></li>'%(E(a),E(b)) for a,b in sl)
    return f'''<figure class="fig">
<div class="phone" role="img" aria-label="Exemplo de anúncio para a busca {E(q)}">
<div class="speaker"></div>
<div class="screen">
<div class="sbar"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15 15l6 6" stroke="currentColor" stroke-width="2"/></svg><span>{E(q)}</span></div>
<div class="ad">
<div class="meta"><b>Patrocinado</b> · {E(url)}</div>
<h3>{E(title)}</h3>
<p>{E(ds[0])} {E(ds[1])}</p>
<div class="btns"><span class="btn"><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M6.6 10.8a15 15 0 006.6 6.6l2.2-2.2a1 1 0 011-.25 11 11 0 003.5.55 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.2.2 2.4.55 3.5a1 1 0 01-.25 1z" fill="currentColor"/></svg>Ligar</span><span class="btn"><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M4 4h16v12H8l-4 4z" fill="currentColor"/></svg>Mensagem</span></div>
<ul class="sl">{sls}</ul>
<div class="loc">Rua Sete de Setembro, 55 · Brusque, SC</div>
</div></div></div>
<figcaption><strong>Busca:</strong> “{E(q)}”<br><span class="more">O Google também combina estes títulos: {E(' · '.join(others))}</span></figcaption>
</figure>'''
sections=''
for c in order:
    items=[r for r in ads if r['Campaign']==c]
    sections+=f'<section><header class="sh"><h2>{E(nice[c])}</h2><p class="bud">R$ {budget[c]} por dia</p></header><div class="row">'+''.join(phone(r) for r in items)+'</div></section>'
page=open('AMOSTRAS-ANUNCIOS-GOOGLE.template.html',encoding='utf-8').read().replace('%%SECTIONS%%',sections)
open('AMOSTRAS-ANUNCIOS-GOOGLE.html','w',encoding='utf-8').write(page)
print(len(ads),'anúncios',len(page),'bytes')
