
import pathlib
base = pathlib.Path("/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src")

# Read the hook content from a separate file
hook_path = base / "hooks" / "useComplianceCalendar.ts"
view_path = base / "views" / "ComplianceCalendar.tsx"

print(f"Hook target: {hook_path}")
print(f"View target: {view_path}")
print(f"Hook exists: {hook_path.exists()}")
print(f"View exists: {view_path.exists()}")
