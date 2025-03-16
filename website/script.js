const video = document.getElementById('webcam');
const outputCanvas = document.getElementById('output');
const ctx = outputCanvas.getContext('2d');
const rightHandGestureElement = document.getElementById('rightHandGesture');
const leftHandGestureElement = document.getElementById('leftHandGesture');

const FLASK_SERVER = "http://b869-202-8-116-114.ngrok-free.app/update_gesture"; // Auto-detect Raspberry Pi IP

function sendGestureData(rightHand, leftHand) {
    console.log(`🔹 Sending → Right: ${rightHand}, Left: ${leftHand}`); // ✅ Log gesture data

    fetch(FLASK_SERVER, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            right_hand: rightHand,
            left_hand: leftHand
        })
    })
    .then(response => response.json())
    .then(data => console.log("✅ Server Response:", data)) // ✅ Log Flask response
    .catch(err => console.error("❌ Failed to send:", err)); // ❌ Log error details
}
// ✅ Start Camera with Permission Handling
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        video.play();
        console.log("Camera started successfully");
    } catch (err) {
        console.error("Error accessing webcam:", err);
        alert("Failed to access webcam. Please check camera permissions and try again.");
    }
}

// ✅ Initialize MediaPipe Hands
const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

hands.onResults((results) => {
    ctx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
    ctx.drawImage(results.image, 0, 0, outputCanvas.width, outputCanvas.height);

    let rightHandGesture = "None";
    let leftHandGesture = "None";

    if (results.multiHandLandmarks) {
        for (let i = 0; i < results.multiHandLandmarks.length; i++) {
            const landmarks = results.multiHandLandmarks[i];
            const handedness = results.multiHandedness[i].label; // "Left" or "Right"

            drawLandmarks(ctx, landmarks, { color: '#FF0000', lineWidth: 2 });
            drawConnectors(ctx, landmarks, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });

            if (handedness === "Left") {
                leftHandGesture = detectLeftHandGesture(landmarks);
            } else {
                rightHandGesture = detectRightHandGesture(landmarks);
            }
        }
    }

    rightHandGestureElement.textContent = `Right Hand: ${rightHandGesture}`;
    leftHandGestureElement.textContent = `Left Hand: ${leftHandGesture}`;

    sendGestureData(rightHandGesture, leftHandGesture);
});

// ✅ Send Gesture Data to Flask Every 200ms
let lastSentTime = 0;
function sendGestureData(rightHand, leftHand) {
    let currentTime = Date.now();
    if (currentTime - lastSentTime >= 200) {
        lastSentTime = currentTime;

        fetch(FLASK_SERVER, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                right_hand: rightHand,
                left_hand: leftHand
            })
        })
        .then(response => response.json())
        .then(data => console.log("Server Response:", data))
        .catch(err => console.error("Failed to send:", err));
    }
}

// ✅ Detect Left Hand Gestures (Motor Control)
function detectLeftHandGesture(landmarks) {
    const fingers = [8, 12, 16, 20]; // Index, Middle, Ring, Little
    let extendedFingers = [];

    for (let i = 0; i < fingers.length; i++) {
        if (landmarks[fingers[i]].y < landmarks[fingers[i] - 2].y) {
            extendedFingers.push(fingers[i]);
        }
    }

    let littleExtended = extendedFingers.includes(20);
    let ringExtended = extendedFingers.includes(16);
    let indexExtended = extendedFingers.includes(8);

    if (extendedFingers.length === 0) return "Fist (Do Nothing)";
    if (extendedFingers.length === 1 && indexExtended) return "Motor 1";
    if (extendedFingers.length === 2 && extendedFingers.includes(12)) return "Motor 2";
    if (extendedFingers.length === 3 && extendedFingers.includes(16)) return "Motor 3";
    if (extendedFingers.length === 4 && extendedFingers.includes(20)) return "Motor 4";
    if (littleExtended && ringExtended) return "Motor 5"; // Little + Ring
    if (littleExtended && extendedFingers.length === 1) return "Motor 6"; // Only Little Finger

    return "Unknown Gesture";
}

// ✅ Detect Right Hand Gestures (Direction Control)
function detectRightHandGesture(landmarks) {
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];

    const distance = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
    return distance < 0.1 ? "Rotate Clockwise" : "Rotate Anticlockwise";
}

// ✅ Start Everything After Page Loads
window.onload = async () => {
    await startCamera(); // Ensure the camera starts before processing
    console.log("Initializing MediaPipe Hands...");

    const camera = new Camera(video, {
        onFrame: async () => {
            await hands.send({ image: video });
        },
        width: 720,
        height: 540
    });
    camera.start();
    console.log("MediaPipe Hands initialized successfully");
};
