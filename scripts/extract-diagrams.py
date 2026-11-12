import json
import shutil
import subprocess
from pathlib import Path
from xml.etree import ElementTree as ET

PDF = Path('/home/ubuntu/upload/營業用動力小船測驗題庫(111.09.01修訂1版)(1)(1).pdf')
DATA = Path('/home/ubuntu/seawise/public/data/questions.json')
OUT = Path('/home/ubuntu/seawise/public/diagram-crops')
TMP = Path('/tmp/seawise-pdf-diagrams')

# Coordinates are the original PDF-to-HTML image-object tops. They select only
# the diagram belonging to each image-option question, never the full page.
MAPPINGS = {
    '避碰-2-132': (16, 571),
    '避碰-10-140': (18, 564),
    '避碰-11-141': (18, 820),
    '避碰-17-147': (19, 795),
    '避碰-33-163': (21, 139),
    '避碰-45-175': (22, 410),
    '避碰-2-182': (23, 360),
    '避碰-5-185': (23, 999),
    '避碰-11-191': (24, 614),
    '避碰-12-192': (24, 808),
    '避碰-16-196': (25, 136),
    '避碰-17-197': (25, 370),
    '避碰-18-198': (25, 638),
    '避碰-19-199': (25, 903),
    '避碰-24-204': (26, 672),
    '避碰-27-207': (27, 131),
    '氣（-20-390': (41, 360),
    '通訊-20-727': (65, 514),
}

TMP.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)
data = json.loads(DATA.read_text())
by_id = {q['id']: q for q in data}

for question_id, (page, target_top) in MAPPINGS.items():
    if question_id not in by_id:
        raise SystemExit(f'missing question id: {question_id}')
    prefix = TMP / f'p{page}'
    xml_path = prefix.with_suffix('.xml')
    if not xml_path.exists():
        subprocess.run(['pdftohtml', '-xml', '-hidden', '-f', str(page), '-l', str(page), str(PDF), str(prefix)], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    root = ET.parse(xml_path).getroot()
    selected = None
    for image in root.iter('image'):
        if int(float(image.attrib['top'])) == target_top:
            selected = image.attrib
            break
    if not selected:
        raise SystemExit(f'missing image object page={page} top={target_top} for {question_id}')
    source = Path(selected['src'])
    # pdftohtml writes the extracted member beside the requested prefix.
    if not source.exists():
        source = prefix.parent / Path(selected['src']).name
    if not source.exists():
        raise SystemExit(f'missing extracted image: {selected["src"]}')
    suffix = source.suffix.lower() if source.suffix.lower() in {'.png', '.jpg', '.jpeg'} else '.png'
    target = OUT / f'{question_id}{suffix}'
    shutil.copyfile(source, target)
    q = by_id[question_id]
    q['diagramImage'] = f'/diagram-crops/{target.name}'
    q['diagramSourcePage'] = page
    q['diagramOriginalBounds'] = {k: int(float(selected[k])) for k in ('left', 'top', 'width', 'height')}

DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2))
print(json.dumps({
    'questions': len(MAPPINGS),
    'assets': len(list(OUT.iterdir())),
    'fields_added': sum('diagramImage' in q for q in data),
}, ensure_ascii=False))
