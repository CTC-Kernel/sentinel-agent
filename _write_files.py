import pathlib, base64, sys
base = pathlib.Path("/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src")
data = sys.stdin.read()
decoded = base64.b64decode(data).decode()
target = base / sys.argv[1]
target.write_text(decoded)
print(f"Wrote {len(decoded)} chars to {target}")
