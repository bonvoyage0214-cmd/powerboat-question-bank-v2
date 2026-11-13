import json
import shutil
from pathlib import Path
from xml.etree import ElementTree as ET

DATA = Path('/home/ubuntu/seawise/public/data/questions.json')
XML_DIR = Path('/tmp/all-pdf-xml')
OUT = Path('/home/ubuntu/seawise/public/diagram-crops')

# (question id): (physical PDF page, image-object top coordinate)
# The top coordinate comes from pdftohtml XML and selects the image only.
MAPPING = {
    '避碰-1-131': (16, 290), '避碰-2-132': (16, 571), '避碰-3-133': (16, 871),
    '避碰-4-134': (17, 229), '避碰-5-135': (17, 366), '避碰-6-136': (17, 630),
    '避碰-8-138': (18, 247), '避碰-10-140': (18, 564), '避碰-11-141': (18, 820),
    '避碰-16-146': (19, 601), '避碰-17-147': (19, 795),
    '避碰-33-163': (21, 139), '避碰-34-164': (21, 460), '避碰-35-165': (21, 670),
    '避碰-45-175': (22, 410),
    '避碰-2-182': (23, 360), '避碰-3-183': (23, 592), '避碰-4-184': (23, 831), '避碰-5-185': (23, 999),
    '避碰-9-189': (24, 396), '避碰-11-191': (24, 614), '避碰-12-192': (24, 808),
    '避碰-16-196': (25, 136), '避碰-17-197': (25, 370), '避碰-18-198': (25, 638), '避碰-19-199': (25, 903),
    '避碰-21-201': (26, 279), '避碰-22-202': (26, 407), '避碰-23-203': (26, 539),
    '避碰-24-204': (26, 672), '避碰-26-206': (26, 933), '避碰-27-207': (27, 131),
    '航海-27-297': (33, 819), '航海-28-298': (34, 111), '航海-39-309': (35, 195),
    '航海-5-320': (36, 454), '航海-10-325': (36, 787),
    '航海-45-360': (38, 534), '航海-46-361': (38, 710),
    '氣（-20-390': (41, 360), '氣（-29-399': (41, 1003),
    '船藝-5-623': (56, 478), '船藝-6-624': (56, 542), '船藝-7-625': (56, 607), '船藝-8-626': (56, 672),
    '船藝-19-657': (59, 303), '船藝-20-658': (59, 467), '船藝-23-661': (59, 810),
    '船藝-6-684': (62, 476), '船藝-13-691': (62, 921),
    '船藝-19-696': (63, 259), '船藝-20-697': (63, 333), '船藝-21-698': (63, 408),
    '船藝-22-699': (63, 491), '船藝-23-700': (63, 577), '船藝-30-707': (63, 964),
    '通訊-20-727': (65, 514),
}
# Resolve one duplicated/uncertain ID after loading current stable records.
OUT.mkdir(parents=True, exist_ok=True)
data = json.loads(DATA.read_text())
by_id = {q['id']: q for q in data}

for qid, (page, target_top) in MAPPING.items():
    if qid not in by_id:
        raise SystemExit(f'missing question id: {qid}')
    xml_path = XML_DIR / f'p{page}.xml'
    if not xml_path.exists():
        raise SystemExit(f'missing XML page: {xml_path}')
    root = ET.parse(xml_path).getroot()
    selected = None
    for image in root.iter('image'):
        if int(float(image.attrib['top'])) == target_top:
            selected = image.attrib
            break
    if not selected:
        raise SystemExit(f'missing image object page={page} top={target_top} for {qid}')
    source = Path(selected['src'])
    if not source.exists():
        source = XML_DIR / source.name
    if not source.exists():
        raise SystemExit(f'missing extracted image: {selected["src"]}')
    suffix = source.suffix.lower() if source.suffix.lower() in {'.png', '.jpg', '.jpeg'} else '.png'
    target = OUT / f'{qid}{suffix}'
    shutil.copyfile(source, target)
    q = by_id[qid]
    q['diagramImage'] = f'/diagram-crops/{target.name}'
    q['diagramSourcePage'] = page
    q['diagramOriginalBounds'] = {k: int(float(selected[k])) for k in ('left', 'top', 'width', 'height')}

DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2))
print(json.dumps({'mapped': len(MAPPING), 'questions_with_diagrams': sum(bool(q.get('diagramImage')) for q in data)}, ensure_ascii=False))
