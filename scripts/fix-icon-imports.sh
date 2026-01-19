#!/bin/bash

# Fix lucide-react imports to use centralized Icons.tsx
# This script replaces direct lucide-react imports with imports from ui/Icons

find src/components src/views -name "*.tsx" -type f | while read file; do
    # Skip Icons.tsx itself
    if [[ "$file" == *"Icons.tsx" ]]; then
        continue
    fi
    
    # Check if file has lucide-react import
    if grep -q "from 'lucide-react'" "$file" || grep -q 'from "lucide-react"' "$file"; then
        # Calculate relative path to Icons.tsx
        dir=$(dirname "$file")
        depth=$(echo "$dir" | sed 's|src/||' | tr '/' '\n' | wc -l)
        
        # Build relative path
        rel_path=""
        for ((i=0; i<depth; i++)); do
            rel_path="../$rel_path"
        done
        
        # Determine correct import path based on location
        if [[ "$file" == *"/views/"* ]]; then
            icons_path="../components/ui/Icons"
        elif [[ "$file" == *"/components/ui/"* ]]; then
            icons_path="./Icons"
        elif [[ "$file" == *"/components/"*"/"*"/"* ]]; then
            icons_path="../../ui/Icons"
        elif [[ "$file" == *"/components/"*"/"* ]]; then
            icons_path="../ui/Icons"
        else
            icons_path="./ui/Icons"
        fi
        
        # Replace import, handling both quote styles
        sed -i '' "s|from 'lucide-react'|from '$icons_path'|g" "$file"
        sed -i '' "s|from \"lucide-react\"|from '$icons_path'|g" "$file"
        
        echo "Fixed: $file -> $icons_path"
    fi
done

echo "Done!"
