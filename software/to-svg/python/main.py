import os
import convert

def run_conversion(
    input_path, output_path, num_colors, apply_sharpening,
    median_blur_ksize, dilate_iterations, epsilon_factor, bg_color,
    apply_resizing, max_side_length, gaussian_blur_ksize, add_stroke,
    stroke_color, stroke_width):
    
    try:
        r, g, b = bg_color
        background_fill_color = (r, g, b)
    except ValueError:
        print(f"Invalid background color")
        return False
    
    stroke_color_rgb = None
    if add_stroke:
        try:
            sr, sg, sb = stroke_color
            stroke_color_rgb = (sr, sg, sb)
        except ValueError:
            print(f"Invalid stroke color")
            return False

    if not os.path.exists(input_path):
        print(f"Input file not found")
        return False

    if median_blur_ksize % 2 == 0 and median_blur_ksize != 0: median_blur_ksize += 1
    if gaussian_blur_ksize % 2 == 0 and gaussian_blur_ksize != 0: gaussian_blur_ksize += 1

    convert.png_color_to_svg_high_fidelity(
        image_path=input_path, output_path=output_path, num_colors=num_colors,
        epsilon_factor=epsilon_factor, background_fill_color=background_fill_color,
        apply_sharpening=apply_sharpening, median_blur_ksize=median_blur_ksize,
        dilate_iterations=dilate_iterations, apply_resizing=apply_resizing,
        max_side_length=max_side_length, gaussian_blur_ksize=gaussian_blur_ksize,
        add_stroke=add_stroke, stroke_color=stroke_color_rgb, stroke_width=stroke_width
    )
    return True