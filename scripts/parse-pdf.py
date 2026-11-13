import json, re, pathlib

SOURCE = pathlib.Path('/home/ubuntu/upload/營業用動力小船測驗題庫(111.09.01修訂1版)(1)(1).pdf')
TEXT = pathlib.Path('/tmp/question_bank.txt')
OUT = pathlib.Path('/home/ubuntu/seawise/public/data/questions.json')

if not TEXT.exists():
    raise SystemExit('missing /tmp/question_bank.txt; run pdftotext -layout first')

text = TEXT.read_text()
category_patterns = [
    (r'一、\s*海事法規', '海事法規'),
    (r'二、\s*避碰規則', '避碰規則'),
    (r'三、\s*航海常識', '航海常識'),
    (r'四、\s*氣（海）象常識', '氣（海）象常識'),
    (r'五、\s*船機常識', '船機常識'),
    (r'六、\s*船藝與操船', '船藝與操船'),
    (r'七、\s*通訊與緊急措施', '通訊與緊急措施'),
]
category_positions = []
for pattern, label in category_patterns:
    found = list(re.finditer(pattern, text))
    if found:
        # The last occurrence is the actual section heading after the TOC.
        category_positions.append((found[-1].start(), label))
category_positions.sort()

# Question records always start with a leading answer marker and a number.
starts = list(re.finditer(r'(?m)^\s*\(([ABCD])\)\s+(\d+)\s+', text))
records = []
for i, match in enumerate(starts):
    block = text[match.start(): starts[i + 1].start() if i + 1 < len(starts) else len(text)]
    answer = match.group(1)
    number = int(match.group(2))
    # Use text position to assign the major category, ignoring the TOC occurrence.
    major = next((label for pos, label in reversed(category_positions) if pos <= match.start()), '未分類')
    # Strip page form-feed and page numbers, which can occur between question records.
    block = block.replace('\f', ' ')
    block = re.sub(r'\s+\d+\s*$', ' ', block)
    body = re.sub(r'^\s*\([ABCD]\)\s+\d+\s+', '', block, count=1)
    body = re.sub(r'\s+', ' ', body).strip()
    # A record can end at a page break before the next category heading. Do not
    # let the footer page number or the following heading become an option.
    body = re.sub(r'\s+\d+\s+(?:一、海事法規|二、避碰規則|三、航海常識|四、氣（海）象常識|五、船機常識|六、船藝與操船|七、通訊與緊急措施)(?:\s+\d+\.\s+[^()]+)?\s*$', ' ', body)
    # PDF text extraction preserves layout spacing. Chinese question text should
    # not inherit those artificial gaps (for example: 下 圖 為 何 種 繩 結).
    body = re.sub(r'(?<=[\u4e00-\u9fff])\s+(?=[\u4e00-\u9fff])', '', body)
    option_matches = list(re.finditer(r'\(([ABCD])\)', body))
    # Page number is useful for later exact diagram attachment; retain an approximate source page.
    page = text[:match.start()].count('\f') + 1
    # Diagram questions may have a text-layer cluster like "下圖(A) (B) (C) (D)何者...".
    # Those labels are part of the prompt, not four textual options.
    diagram_label_cluster = bool(re.search(r'(?:下圖|下列|各圖|圖示|圖中).{0,18}\(A\)\s*\(B\)\s*\(C\)\s*\(D\)', body))
    image_options = len(option_matches) < 4 or diagram_label_cluster
    question = body.strip() if image_options else body[:option_matches[0].start()].strip()
    # A few pages contain repeated full-width A-D glyphs from the adjacent
    # diagram layer. They are not part of the question sentence.
    question = re.sub(r'(?:\s*[A-DＡ-Ｄ]){3,}\s*$', '', question).strip()
    if image_options:
        # Some questions use four labeled diagrams as options, so the PDF text layer
        # contains no A-D option strings. Keep the labels selectable and show the
        # original page image without inventing a textual interpretation.
        options = {letter: f'原始圖示選項（{letter}）· 請參照第 {page} 頁' for letter in 'ABCD'}
    else:
        options = {}
        for j, opt in enumerate(option_matches[:4]):
            end = option_matches[j + 1].start() if j + 1 < len(option_matches) else len(body)
            value = body[opt.end():end].strip(' 。\t\n')
            options[opt.group(1)] = value
    if len(question) < 2 or len(options) != 4:
        continue
    record = {
        'id': f'{major[:2]}-{number}-{len(records)+1}',
        'category': major,
        'number': number,
        'question': question,
        'options': options,
        'answer': answer,
        'sourcePage': page,
        'source': '營業用動力小船題庫（111.09.01 修訂 1 版）',
    }
    if image_options:
        record['imageOptions'] = True
    records.append(record)

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(records, ensure_ascii=False, indent=2))
print(json.dumps({
    'total': len(records),
    'categories': {label: sum(r['category'] == label for r in records) for _, label in category_patterns},
    'first': records[:2],
    'last': records[-2:],
}, ensure_ascii=False, indent=2))
