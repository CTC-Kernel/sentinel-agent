from PIL import Image, ImageDraw

def create_icon(output_path, bg_color=(28, 28, 30, 255), icon_size=(512, 512)):
    # Create a 512x512 transparent image
    img = Image.new('RGBA', icon_size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Draw rounded rectangle for the background
    # Standard macOS icon corner radius for 512x512 is about 22.5% of size (approx 115px)
    # But since it's a square-ish app icon, let's use a standard rounded corner.
    radius = 100
    padding = 20 # Small padding to avoid touching the edges if needed, but the user wants it to cover the square.
    # Actually, let's make it fill the frame as much as possible but with clean edges.
    shape = [padding, padding, icon_size[0] - padding, icon_size[1] - padding]
    draw.rounded_rectangle(shape, fill=bg_color, radius=radius)
    
    # Draw Padlock
    # Shackle (the loop)
    shackle_top = 130
    shackle_bottom = 280
    shackle_left = 180
    shackle_right = 332
    shackle_width = 45
    
    # Draw the arc for the shackle
    draw.arc([shackle_left, shackle_top, shackle_right, shackle_top + (shackle_right-shackle_left)], 
             start=180, end=0, fill="white", width=shackle_width)
    # Draw the vertical lines for the shackle
    draw.line([shackle_left + shackle_width//2 - 1, shackle_top + (shackle_right-shackle_left)//2, 
               shackle_left + shackle_width//2 - 1, shackle_bottom], fill="white", width=shackle_width)
    draw.line([shackle_right - shackle_width//2, shackle_top + (shackle_right-shackle_left)//2, 
               shackle_right - shackle_width//2, shackle_bottom], fill="white", width=shackle_width)
    
    # Body (the rectangle)
    body_shape = [150, 250, 362, 430]
    draw.rounded_rectangle(body_shape, fill="white", radius=30)
    
    # Save the result
    img.save(output_path)
    print(f"Icon saved to {output_path}")

if __name__ == "__main__":
    create_icon("crates/agent-gui/assets/app-icon.png")
