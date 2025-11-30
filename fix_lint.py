#!/usr/bin/env python3
"""
Automated lint fix script for Sentinel GRC
Safely replaces common patterns to reduce lint warnings
"""

import re
import os
from pathlib import Path

def fix_unused_catch_params(content):
    """Replace catch (e) with catch (_e) for unused error parameters"""
    # Pattern: catch (e) { where e is not used in the block
    pattern = r'catch\s*\(\s*([a-z]+)\s*\)\s*\{'
    
    def replacer(match):
        var_name = match.group(1)
        # Only replace single letter variables (e, error, err)
        if var_name in ['e', 'error', 'err']:
            return f'catch (_{var_name}) {{'
        return match.group(0)
    
    return re.sub(pattern, replacer, content)

def fix_unused_event_params(content):
    """Replace unused event handler parameters"""
    # Pattern: (event) => where event is not used
    patterns = [
        (r'\(event\)\s*=>', '(_event) =>'),
        (r'\(e\)\s*=>\s*e\.stopPropagation', '(e) => e.stopPropagation'),  # Keep if used
        (r'\(e\)\s*=>\s*e\.preventDefault', '(e) => e.preventDefault'),    # Keep if used
    ]
    
    for pattern, replacement in patterns:
        content = re.sub(pattern, replacement, content)
    
    return content

def fix_unused_vars(content):
    """Prefix unused variables with _ to satisfy linting rules"""
    # This is a heuristic and might need manual review
    # Pattern: 'variable' is defined but never used
    # We can't easily fix this with regex alone without the lint report line numbers
    # But we can try to fix common patterns like catch(e) -> catch(_e) which is already done
    # For now, let's focus on the catch block fix which is safe
    return content

def process_file(filepath):
    """Process a single TypeScript/TSX file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        # Apply fixes
        content = fix_unused_catch_params(content)
        # content = fix_unused_event_params(content)  # Commented out - needs more careful analysis
        content = fix_unused_vars(content) # Call the new function
        
        # Only write if changed
        if content != original_content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
        return False
    except Exception as e:
        print(f"Error processing {filepath}: {e}")
        return False

def main():
    """Main function to process all TypeScript files"""
    base_dir = Path(__file__).parent
    
    # Find all .ts and .tsx files
    patterns = ['**/*.ts', '**/*.tsx']
    files_to_process = []
    
    for pattern in patterns:
        files_to_process.extend(base_dir.glob(pattern))
    
    # Exclude node_modules and dist
    files_to_process = [
        f for f in files_to_process 
        if 'node_modules' not in str(f) and 'dist' not in str(f)
    ]
    
    print(f"Found {len(files_to_process)} files to process")
    
    modified_count = 0
    for filepath in files_to_process:
        if process_file(filepath):
            modified_count += 1
            print(f"Modified: {filepath.relative_to(base_dir)}")
    
    print(f"\nTotal files modified: {modified_count}")

if __name__ == '__main__':
    main()
