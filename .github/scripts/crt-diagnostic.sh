#!/usr/bin/env bash
# TEMPORARY (verification run only, not part of the fix): shows which C runtime
# whisper.cpp was compiled for and which runtime DLLs the agent imports.
# Usage: crt-diagnostic.sh <debug|release>
set -u
profile="$1"

for d in target/"$profile"/build/whisper-rs-sys-*/; do
  [ -f "$d/stderr" ] || continue
  echo "== $d ($(date -r "$d/stderr" '+%H:%M:%S' 2>/dev/null))"
  echo "-- CMake calls made by the build script"
  grep -a '^running: ' "$d/stderr" |
    grep -a -o '"-DCMAKE_BUILD_TYPE=[^"]*"\|"-DCMAKE_C[X]*_FLAGS[A-Z_]*=[^"]*"\|"--config" "[A-Za-z]*"\|"-G" "[^"]*"'
  find "$d/out" \( -name 'whisper.lib' -o -name 'libwhisper.a' \) | while read -r lib; do
    echo "-- runtime directives in $lib"
    grep -a -o -i 'DEFAULTLIB:"\{0,1\}[A-Za-z0-9_.]*"\{0,1\}\|RuntimeLibrary=[A-Za-z_]*' "$lib" | sort | uniq -c
  done
done

exe="target/$profile/agent-core.exe"
if [ -f "$exe" ]; then
  echo "-- C runtime DLL names present in $exe (none expected with +crt-static)"
  grep -a -o -i 'vcruntime[0-9_]*\.dll\|msvcp[0-9_a-z]*\.dll\|api-ms-win-crt-[a-z0-9-]*\.dll\|ucrtbase[a-z]*\.dll' "$exe" | sort | uniq -c
  vswhere="/c/Program Files (x86)/Microsoft Visual Studio/Installer/vswhere.exe"
  if [ -x "$vswhere" ]; then
    dumpbin=$("$vswhere" -latest -products '*' -find 'VC\Tools\MSVC\**\bin\Hostx64\x64\dumpbin.exe' | tr -d '\r' | tail -1)
    if [ -n "$dumpbin" ]; then
      echo "-- DLLs imported by $exe (dumpbin -dependents)"
      "$(cygpath -u "$dumpbin")" -nologo -dependents "$exe" | tr -d '\r' | grep -i '\.dll$'
    fi
  fi
fi
exit 0
