#!/bin/bash

# Auto-increment version script with tag conflict resolution
VERSION="${1}"
BUMP="${2}"

# Read current version from Cargo.toml
CURRENT=$(grep '^version' Cargo.toml | head -1 | sed 's/.*"\(.*\)".*/\1/')

# Parse version components
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"

# Apply bump
case "$BUMP" in
  major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
  minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
  patch) PATCH=$((PATCH + 1)) ;;
esac

NEXT="${MAJOR}.${MINOR}.${PATCH}"
echo "Next version: $NEXT (bump=$BUMP)"

# Update Cargo.toml with new version
perl -i -pe 's/^version = ".*"/version = "'"$NEXT"'"/' Cargo.toml
echo "Updated Cargo.toml to version $NEXT"

# Check if tag already exists
if git rev-parse "refs/tags/v${NEXT}" >/dev/null 2>&1; then
  echo "Tag v${NEXT} already exists, skipping tag creation"
else
  git tag "v${NEXT}"
  echo "Created tag v${NEXT}"
fi

echo "version=$NEXT" >> "$GITHUB_OUTPUT"
