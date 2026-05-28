# Neon Light Painter

An immersive browser-based interactive art experience. The page uses the webcam as a mirrored full-screen background, tracks the user's index fingertip with MediaPipe Hands, and paints fading neon trails on a transparent canvas layer.

## Features

- Runs entirely in the browser with HTML, CSS, and JavaScript
- Uses the front-facing camera on mobile when available
- Mirrors the camera preview for natural interaction
- Tracks the index fingertip with MediaPipe Hands
- Draws glowing long-exposure style light trails
- Smooths fingertip coordinates with linear interpolation
- Supports multiple neon colors
- Includes camera, clear, and color controls
- Responsive layout for phones and desktop browsers
- Friendly messages for camera permission or model loading errors

## Files

```text
index.html
style.css
script.js
README.md
```

## Local Development

Because browsers usually require a secure context for camera access, open this project from `localhost` rather than by double-clicking the HTML file.

From the project folder, run one of these commands:

```bash
python3 -m http.server 5173
```

Then open:

```text
http://localhost:5173
```

If you use Node.js, this also works:

```bash
npx serve .
```

## Deployment

This is a static site and can be deployed without a backend.

### GitHub Pages

1. Push these files to a GitHub repository.
2. Open the repository settings.
3. Go to **Pages**.
4. Choose the branch and root folder that contain `index.html`.
5. Save and open the generated HTTPS URL.

### Vercel or Netlify

1. Import the repository.
2. Keep the build command empty.
3. Set the output directory to the project root.
4. Deploy.

## Camera Notes

Camera access requires HTTPS in production. `localhost` is treated as secure by modern browsers for development. On mobile, use the deployed HTTPS URL or a local network HTTPS setup.

The project loads MediaPipe Hands from jsDelivr:

```html
https://cdn.jsdelivr.net/npm/@mediapipe/hands
```

If the CDN is blocked or unavailable, the app will show a model loading error instead of failing silently.

## How It Works

1. The user clicks **Start Camera**.
2. The browser requests camera permission.
3. MediaPipe Hands analyzes the live video frame by frame.
4. The index fingertip landmark is mapped onto the canvas.
5. The canvas draws multiple layered strokes with additive blending, blur, and transparency.
6. Each animation frame softly erases previous pixels, creating a fading long-exposure trail.
