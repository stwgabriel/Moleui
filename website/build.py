#!/usr/bin/env python3
"""Assemble website/index.html from index.template.html + section fragments.

Usage: python3 build.py [sections_dir]
Markers like <!-- @@SECTION:clean@@ --> are replaced with the contents of
<sections_dir>/clean.html. Missing sections are left as HTML comments so the
page still renders during development.
"""
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent
SECTIONS = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "sections"

template = (HERE / "index.template.html").read_text()
missing = []


def sub(match: re.Match) -> str:
    name = match.group(1)
    path = SECTIONS / f"{name}.html"
    if path.exists():
        return path.read_text()
    missing.append(name)
    return match.group(0)


out = re.sub(r"<!-- @@SECTION:(\w+)@@ -->", sub, template)
out = out.replace("<!-- @@SCRIPTS@@ -->", "")
(HERE / "index.html").write_text(out)
print(f"wrote index.html ({len(out):,} bytes)")
if missing:
    print(f"missing sections left as markers: {', '.join(missing)}")
