#!/usr/bin/env python3
"""
Script to remove text overlays from homepage images.
Uses OpenCV inpainting to fill in text regions.
"""

import cv2
import numpy as np
import sys
import os
from pathlib import Path

def detect_text_region(image):
    """
    Detect text regions in the image using color and edge detection.
    The text appears to be in a golden/yellow/pink color with dark outline.
    """
    # Convert to different color spaces for better text detection
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # Create masks for text colors (golden/yellow/pink)
    # Golden/yellow text
    lower_yellow = np.array([20, 100, 100])
    upper_yellow = np.array([30, 255, 255])
    mask_yellow = cv2.inRange(hsv, lower_yellow, upper_yellow)
    
    # Pink/red text
    lower_pink = np.array([150, 100, 100])
    upper_pink = np.array([180, 255, 255])
    mask_pink = cv2.inRange(hsv, lower_pink, upper_pink)
    
    # Combine masks
    text_mask = cv2.bitwise_or(mask_yellow, mask_pink)
    
    # Focus on center region where text typically appears
    h, w = image.shape[:2]
    center_region = text_mask[int(h*0.3):int(h*0.7), int(w*0.1):int(w*0.9)]
    
    # Apply morphological operations to clean up the mask
    kernel = np.ones((5, 5), np.uint8)
    text_mask = cv2.morphologyEx(text_mask, cv2.MORPH_CLOSE, kernel)
    text_mask = cv2.morphologyEx(text_mask, cv2.MORPH_OPEN, kernel)
    
    # Dilate to ensure we cover the entire text area
    text_mask = cv2.dilate(text_mask, kernel, iterations=3)
    
    return text_mask

def remove_text_inpaint(image_path, output_path):
    """
    Remove text from image using inpainting.
    """
    # Read the image
    image = cv2.imread(image_path)
    if image is None:
        print(f"Error: Could not read image {image_path}")
        return False
    
    print(f"Processing: {os.path.basename(image_path)}")
    print(f"  Image size: {image.shape[1]}x{image.shape[0]}")
    
    # Detect text region
    text_mask = detect_text_region(image)
    
    # If mask is too small, try a different approach - look for high contrast text
    if np.sum(text_mask) < image.shape[0] * image.shape[1] * 0.01:
        # Try edge detection approach
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 50, 150)
        
        # Look for rectangular regions in center (where text typically is)
        h, w = image.shape[:2]
        center_region = edges[int(h*0.25):int(h*0.75), int(w*0.05):int(w*0.95)]
        
        # Find contours in center region
        contours, _ = cv2.findContours(center_region, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        # Create mask from large contours (likely text)
        text_mask = np.zeros(gray.shape, dtype=np.uint8)
        for contour in contours:
            area = cv2.contourArea(contour)
            if area > 500:  # Filter small noise
                x, y, w_cont, h_cont = cv2.boundingRect(contour)
                # Expand the bounding box slightly
                cv2.rectangle(text_mask, 
                            (max(0, x-10), max(0, y-10)), 
                            (min(text_mask.shape[1], x+w_cont+10), min(text_mask.shape[0], y+h_cont+10)), 
                            255, -1)
        
        # Dilate the mask
        kernel = np.ones((10, 10), np.uint8)
        text_mask = cv2.dilate(text_mask, kernel, iterations=2)
    
    # Apply inpainting to remove text
    # Use TELEA algorithm (Fast Marching Method)
    result = cv2.inpaint(image, text_mask, 3, cv2.INPAINT_TELEA)
    
    # Alternative: Use NS algorithm (Navier-Stokes based) - sometimes better quality
    # result = cv2.inpaint(image, text_mask, 5, cv2.INPAINT_NS)
    
    # Save the result
    success = cv2.imwrite(output_path, result)
    
    if success:
        print(f"  ✓ Saved to: {os.path.basename(output_path)}")
        return True
    else:
        print(f"  ✗ Failed to save {output_path}")
        return False

def main():
    # Image files to process
    base_dir = Path("/Users/debasispramanik/Library/Mobile Documents/com~apple~CloudDocs/Project/Sanhoti/backend/data/HomePage_Images")
    
    image_files = [
        "1767626421445-IMG_2643.png",
        "1767626421468-IMG_2642.png",
        "1767626421482-IMG_2641.jpeg"
    ]
    
    success_count = 0
    for image_file in image_files:
        image_path = base_dir / image_file
        
        if not image_path.exists():
            print(f"Error: Image not found: {image_path}")
            continue
        
        # Create backup first
        backup_path = image_path.with_suffix(image_path.suffix + '.backup')
        if not backup_path.exists():
            import shutil
            shutil.copy2(image_path, backup_path)
            print(f"  Created backup: {os.path.basename(backup_path)}")
        
        # Process the image (overwrite original)
        if remove_text_inpaint(str(image_path), str(image_path)):
            success_count += 1
        print()
    
    print(f"Processed {success_count}/{len(image_files)} images successfully.")
    print(f"Backups saved with .backup extension. Original files have been modified.")

if __name__ == "__main__":
    main()

