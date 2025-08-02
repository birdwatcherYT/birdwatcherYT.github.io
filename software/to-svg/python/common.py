import cv2
import numpy as np

def contour_to_svg_path(contour, epsilon_factor=0.001):
    if contour is None or len(contour) < 3:
        return ""
    perimeter = cv2.arcLength(contour, True)
    if perimeter == 0:
        return ""
    epsilon = epsilon_factor * perimeter
    approx_contour = cv2.approxPolyDP(contour, epsilon, True)
    if len(approx_contour) < 1:
        return ""
    path_data = f"M {approx_contour[0][0][0]},{approx_contour[0][0][1]}"
    for point in approx_contour[1:]:
        x, y = point[0]
        path_data += f" L {x},{y}"
    path_data += " Z"
    return path_data

def preprocess_image(image_path: str, background_fill_color: tuple, apply_resizing: bool, max_side_length: int):
    img = cv2.imread(image_path, cv2.IMREAD_UNCHANGED)
    if img is None:
        print(f"エラー: {image_path} から画像を読み込めませんでした")
        return None
    if apply_resizing and max_side_length > 0:
        h_orig, w_orig = img.shape[:2]
        current_max_side = max(h_orig, w_orig)
        if current_max_side != max_side_length:
            scaling_factor = max_side_length / current_max_side
            new_w = int(w_orig * scaling_factor)
            new_h = int(h_orig * scaling_factor)
            img = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_LINEAR)
    if img.shape[2] == 4:
        b, g, r, a = cv2.split(img)
        img_3_channel = cv2.merge((b, g, r))
        bg_b, bg_g, bg_r = background_fill_color
        background_color_bgr = (bg_r, bg_g, bg_b)
        background = np.full_like(img_3_channel, background_color_bgr)
        alpha_normalized = a / 255.0
        alpha_3_channel = cv2.merge((alpha_normalized, alpha_normalized, alpha_normalized))
        img_blended = (img_3_channel * alpha_3_channel).astype(np.uint8) + (background * (1 - alpha_3_channel)).astype(np.uint8)
        return img_blended
    else:
        return img