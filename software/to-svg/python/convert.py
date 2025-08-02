import cv2
import numpy as np
import svgwrite
from common import contour_to_svg_path, preprocess_image

def png_color_to_svg_high_fidelity(
    image_path, output_path, num_colors=16, epsilon_factor=0.001,
    background_fill_color=(255, 255, 255), apply_sharpening=False,
    median_blur_ksize=5, dilate_iterations=1, apply_resizing=False,
    max_side_length=1024, gaussian_blur_ksize=0, add_stroke=False,
    stroke_color=(0, 0, 0), stroke_width=1.0):

    img_processed = preprocess_image(image_path, background_fill_color, apply_resizing, max_side_length)
    if img_processed is None: return

    if gaussian_blur_ksize > 0:
        img_processed = cv2.GaussianBlur(img_processed, (gaussian_blur_ksize, gaussian_blur_ksize), 0)
    if median_blur_ksize > 0:
        img_processed = cv2.medianBlur(img_processed, median_blur_ksize)
    if apply_sharpening:
        sharpening_kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]], dtype=np.float32)
        img_processed = cv2.filter2D(img_processed, -1, sharpening_kernel)

    pixels = np.float32(img_processed.reshape((-1, 3)))
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 100, 1.0)
    _, labels, centers = cv2.kmeans(pixels, num_colors, None, criteria, 10, cv2.KMEANS_RANDOM_CENTERS)
    centers = np.uint8(centers)
    quantized_img = centers[labels.flatten()].reshape((img_processed.shape))

    all_paths = []
    kernel = np.ones((3, 3), np.uint8)

    for color in centers:
        mask = cv2.inRange(quantized_img, color, color)
        if dilate_iterations > 0:
            mask_dilated = cv2.dilate(mask, kernel, iterations=dilate_iterations)
        else:
            mask_dilated = mask.copy()
        contours, _ = cv2.findContours(mask_dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        for contour in contours:
            area = cv2.contourArea(contour)
            if area < 50: continue
            path_data = contour_to_svg_path(contour, epsilon_factor=epsilon_factor)
            if not path_data: continue
            b, g, r = color
            fill_color = svgwrite.rgb(r, g, b, "RGB")
            stroke_settings = {}
            if add_stroke:
                stroke_settings = {
                    "stroke": svgwrite.rgb(stroke_color[0], stroke_color[1], stroke_color[2], "RGB"),
                    "stroke_width": stroke_width
                }
            all_paths.append({"area": area, "path_data": path_data, "fill_color": fill_color, "stroke_settings": stroke_settings})

    all_paths.sort(key=lambda p: p['area'], reverse=True)
    h, w, _ = img_processed.shape
    dwg = svgwrite.Drawing(output_path, profile="full", size=(w, h))
    for item in all_paths:
        dwg.add(dwg.path(d=item["path_data"], fill=item["fill_color"], **item["stroke_settings"]))
    dwg.save()