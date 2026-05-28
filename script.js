const video = document.querySelector("#video");
const canvas = document.querySelector("#trailCanvas");
const ctx = canvas.getContext("2d", { alpha: true });

const startButton = document.querySelector("#startButton");
const clearButton = document.querySelector("#clearButton");
const colorButton = document.querySelector("#colorButton");
const colorSwatch = document.querySelector("#colorSwatch");
const statusText = document.querySelector("#statusText");
const statusDot = document.querySelector("#statusDot");
const trackingState = document.querySelector("#trackingState");

const colors = ["#1fe7ff", "#ff2bd6", "#a855ff", "#55ff8a", "#ff9f1c"];
let colorIndex = 0;
let currentColor = colors[colorIndex];

let hands = null;
let stream = null;
let running = false;
let rafId = 0;
let detectTimer = 0;
let lastRawPoint = null;
let smoothedPoint = null;
let previousDrawPoint = null;
let handVisible = false;
let dpr = Math.min(window.devicePixelRatio || 1, 2);

function setStatus(message, mode = "idle") {
  statusText.textContent = message;
  statusDot.classList.toggle("live", mode === "live");
  statusDot.classList.toggle("error", mode === "error");
}

function setTracking(message) {
  trackingState.textContent = message;
}

function resizeCanvas() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

function updateColorUI() {
  document.documentElement.style.setProperty("--active", currentColor);
  colorSwatch.style.background = currentColor;
  colorSwatch.style.boxShadow = `0 0 18px ${currentColor}`;
}

function clearTrail() {
  ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
  previousDrawPoint = null;
}

function loadHandsModel() {
  if (!window.Hands) {
    throw new Error("MediaPipe Hands could not be loaded. Check your internet connection or CDN access.");
  }

  hands = new window.Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
  });

  hands.setOptions({
    selfieMode: false,
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.66,
    minTrackingConfidence: 0.62,
  });

  hands.onResults(handleHandResults);
}

async function startCamera() {
  if (running) return;

  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("This browser does not support camera access. Try a recent mobile or desktop browser.");
    }

    setStatus("Loading hand tracking model...", "idle");
    setTracking("Preparing model");
    startButton.disabled = true;

    if (!hands) {
      loadHandsModel();
    }

    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: "user",
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });

    video.srcObject = stream;
    await video.play();

    video.classList.add("is-live");
    running = true;
    clearButton.disabled = false;
    colorButton.disabled = false;
    startButton.textContent = "Camera Live";

    setStatus("Camera live. Move your index finger to paint with light.", "live");
    setTracking("Searching for hand");

    drawLoop();
    detectLoop();
  } catch (error) {
    console.error(error);
    startButton.disabled = false;
    startButton.textContent = "Start Camera";
    setStatus(getFriendlyError(error), "error");
    setTracking("Unavailable");
  }
}

function getFriendlyError(error) {
  if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
    return "Camera permission was blocked. Allow camera access and try again.";
  }

  if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
    return "No camera was found on this device.";
  }

  return error.message || "The camera or hand tracking model could not start.";
}

async function detectLoop() {
  if (!running || !hands || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    detectTimer = window.setTimeout(detectLoop, 80);
    return;
  }

  try {
    await hands.send({ image: video });
  } catch (error) {
    console.error(error);
    setStatus("Hand tracking paused because the model could not process the frame.", "error");
    setTracking("Model error");
  }

  detectTimer = window.setTimeout(detectLoop, 32);
}

function handleHandResults(results) {
  const landmarks = results.multiHandLandmarks?.[0];

  if (!landmarks) {
    handVisible = false;
    lastRawPoint = null;
    previousDrawPoint = null;
    setTracking("Searching for hand");
    return;
  }

  const indexTip = landmarks[8];
  const mapped = mapVideoPointToCanvas(indexTip.x, indexTip.y);
  lastRawPoint = mapped;
  handVisible = true;
  setTracking("Painting");
}

function mapVideoPointToCanvas(normalizedX, normalizedY) {
  const canvasWidth = canvas.width / dpr;
  const canvasHeight = canvas.height / dpr;
  const videoWidth = video.videoWidth || canvasWidth;
  const videoHeight = video.videoHeight || canvasHeight;

  const scale = Math.max(canvasWidth / videoWidth, canvasHeight / videoHeight);
  const renderedWidth = videoWidth * scale;
  const renderedHeight = videoHeight * scale;
  const offsetX = (canvasWidth - renderedWidth) / 2;
  const offsetY = (canvasHeight - renderedHeight) / 2;

  // The video element is mirrored with CSS, so the landmark x coordinate must be mirrored too.
  const mirroredVideoX = (1 - normalizedX) * videoWidth;
  const videoY = normalizedY * videoHeight;

  return {
    x: offsetX + mirroredVideoX * scale,
    y: offsetY + videoY * scale,
  };
}

function drawLoop() {
  const width = canvas.width / dpr;
  const height = canvas.height / dpr;

  // Fade existing pixels instead of clearing them, creating the long-exposure decay.
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = "rgba(0, 0, 0, 0.045)";
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = "source-over";

  if (handVisible && lastRawPoint) {
    smoothedPoint = smoothPoint(smoothedPoint, lastRawPoint, 0.32);

    if (previousDrawPoint) {
      drawGlowSegment(previousDrawPoint, smoothedPoint);
    }

    previousDrawPoint = { ...smoothedPoint };
  } else {
    smoothedPoint = null;
  }

  rafId = requestAnimationFrame(drawLoop);
}

function smoothPoint(previous, next, amount) {
  if (!previous) return { ...next };

  return {
    x: previous.x + (next.x - previous.x) * amount,
    y: previous.y + (next.y - previous.y) * amount,
  };
}

function drawGlowSegment(from, to) {
  const speed = Math.hypot(to.x - from.x, to.y - from.y);
  const coreWidth = Math.max(5, Math.min(16, speed * 0.42));

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  drawLine(from, to, coreWidth * 6.2, currentColor, 0.06, coreWidth * 5.2);
  drawLine(from, to, coreWidth * 3.3, currentColor, 0.14, coreWidth * 3.1);
  drawLine(from, to, coreWidth * 1.75, currentColor, 0.34, coreWidth * 1.6);
  drawLine(from, to, coreWidth, "#ffffff", 0.9, coreWidth * 0.9);

  ctx.restore();
}

function drawLine(from, to, width, color, alpha, blur) {
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.lineWidth = width;
  ctx.strokeStyle = hexToRgba(color, alpha);
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.stroke();
}

function hexToRgba(hex, alpha) {
  if (hex === "#ffffff") return `rgba(255, 255, 255, ${alpha})`;

  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

startButton.addEventListener("click", startCamera);

clearButton.addEventListener("click", clearTrail);

colorButton.addEventListener("click", () => {
  colorIndex = (colorIndex + 1) % colors.length;
  currentColor = colors[colorIndex];
  updateColorUI();
});

window.addEventListener("resize", () => {
  resizeCanvas();
  clearTrail();
});

window.addEventListener("beforeunload", () => {
  cancelAnimationFrame(rafId);
  clearTimeout(detectTimer);
  stream?.getTracks().forEach((track) => track.stop());
});

resizeCanvas();
updateColorUI();
setStatus("Move your index finger to paint with light");
