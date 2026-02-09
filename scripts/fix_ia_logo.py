from PIL import Image

def fix_ia_logo(input_path, output_path, bg_color=(28, 28, 30, 255)):
    # Open the image
    img = Image.open(input_path).convert("RGBA")
    data = img.getdata()
    
    new_data = []
    for item in data:
        # If it's pure white (or very close), make it transparent
        if item[0] > 240 and item[1] > 240 and item[2] > 240:
            new_data.append((0, 0, 0, 0))
        # If it's pure black (or very close), change it to the new dark gray
        elif item[0] < 15 and item[1] < 15 and item[2] < 15:
            new_data.append(bg_color)
        else:
            new_data.append(item)
    
    img.putdata(new_data)
    img.save(output_path)
    print(f"IA logo fixed and saved to {output_path}")

if __name__ == "__main__":
    fix_ia_logo("crates/agent-gui/assets/IA.png", "crates/agent-gui/assets/IA_fixed.png")
    # Actually overwrite the original
    import os
    os.replace("crates/agent-gui/assets/IA_fixed.png", "crates/agent-gui/assets/IA.png")
