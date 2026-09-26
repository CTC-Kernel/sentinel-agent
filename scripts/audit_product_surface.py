#!/usr/bin/env python3
"""Inventory Rust GUI declarations/references; this is not an end-to-end test.
Run from any directory: python3 scripts/audit_product_surface.py > surface.json
The parser deliberately targets the current four-space enum formatting.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def enum_members(path, name):
    text = (ROOT / path).read_text()
    block = text.split(f'pub enum {name} {{', 1)[1].split('\n}', 1)[0]
    return re.findall(r'^    ([A-Z][A-Za-z0-9_]*)\s*[,({]', block, re.M)

sources = [(p, p.read_text()) for folder in ('crates/agent-gui/src', 'crates/agent-core/src')
           for p in sorted((ROOT / folder).rglob('*.rs'))]
commands = []
for name in enum_members('crates/agent-gui/src/events.rs', 'GuiCommand'):
    references = []
    pattern = re.compile(r'\bGuiCommand::' + re.escape(name) + r'\b')
    for path, source in sources:
        for match in pattern.finditer(source):
            references.append({'file': str(path.relative_to(ROOT)), 'line': source.count('\n', 0, match.start()) + 1})
    commands.append({'command': name, 'references': references,
                     'verification': 'static references only; execution not verified'})
probe = (ROOT / 'crates/agent-gui/examples/scroll_probe.rs').read_text().split('const PAGES:', 1)[1].split('];', 1)[0]
print(json.dumps({
    'method': 'declaration and textual reference inventory; comments/tests can be included; no completeness inference',
    'pages_declared': enum_members('crates/agent-gui/src/app.rs', 'Page'),
    'render_probe_cases': [{'page': name, 'tab': int(tab)} for name, tab in re.findall(r'\("([a-z]+)", (\d+)\)', probe)],
    'commands': commands,
}, ensure_ascii=False, indent=2))
