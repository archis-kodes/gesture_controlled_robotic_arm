from flask import Flask, send_from_directory, request, jsonify
from flask_cors import CORS
from adafruit_servokit import ServoKit
import os

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Allow JavaScript requests

# Initialize PCA9685 Servo Driver
kit = ServoKit(channels=16)

# Store servo angles
servo_angles = {0: 90, 1: 90, 2: 90, 3: 90, 4: 90, 5: 90}  # Default positions
STEP_ANGLE = 1  # Rotate by 1 degree per detection cycle

# Serve the index.html file from the website folder
@app.route("/")
def serve_index():
    return send_from_directory("website", "index.html")

# Serve static files (CSS, JS, images) from website folder
@app.route("/<path:path>")
def serve_static(path):
    return send_from_directory("website", path)

# API to receive gestures and control servos
@app.route("/update_gesture", methods=["POST"])
def update_gesture():
    try:
        data = request.json
        right_hand = data.get("right_hand", "")
        left_hand = data.get("left_hand", "")

        print(f"Received Gesture: Right Hand - {right_hand}, Left Hand - {left_hand}")

        # Define motor-pin mappings
        motor_pins = {
            "Motor 1": 0,
            "Motor 2": 1,
            "Motor 3": 2,
            "Motor 4": 3,
            "Motor 5": 4,
            "Motor 6": 5
        }

        # Rotate servos based on detected gestures
        if left_hand in motor_pins:
            pin = motor_pins[left_hand]

            if right_hand == "Rotate Clockwise" and servo_angles[pin] < 180:
                servo_angles[pin] += STEP_ANGLE
            elif right_hand == "Rotate Anticlockwise" and servo_angles[pin] > 0:
                servo_angles[pin] -= STEP_ANGLE

            # Apply smooth rotation
            kit.servo[pin].angle = servo_angles[pin]
            print(f"{left_hand} on Pin {pin} rotated to {servo_angles[pin]}°")

        return jsonify({"status": "success", "servo_angles": servo_angles})

    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"status": "error", "message": str(e)})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
