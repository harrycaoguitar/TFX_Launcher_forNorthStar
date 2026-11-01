from html.parser import HTMLParser
from pathlib import Path
import json, sys

class Structure(HTMLParser):
    def __init__(self):
        super().__init__(); self.divs=[]; self.vanilla_ancestors=None
    def handle_starttag(self,tag,attrs):
        if tag!='div': return
        values=dict(attrs)
        if values.get('id')=='tfContent': self.vanilla_ancestors=self.divs.copy()
        self.divs.append(values.get('id') or values.get('class','div'))
    def handle_endtag(self,tag):
        if tag=='div' and self.divs: self.divs.pop()

p=Structure(); p.feed(Path(sys.argv[1]).read_text(encoding='utf-8'))
print(json.dumps({'vanillaAncestors':p.vanilla_ancestors,'visibleWhenNorthstarHidden':'nsContent' not in (p.vanilla_ancestors or [])}))
assert p.vanilla_ancestors is not None and 'nsContent' not in p.vanilla_ancestors, 'Vanilla is inside the hidden Northstar container'
