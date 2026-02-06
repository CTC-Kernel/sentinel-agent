import sys, pathlib
target = pathlib.Path(sys.argv[1])
content = pathlib.Path(sys.argv[2]).read_text()
target.write_text(content)
print(f"Wrote {len(content)} chars to {target}")
