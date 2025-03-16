from flask import Flask, send_from_directory
from flask_socketio import SocketIO, emit
from adafruit_servokit import ServoKit
import os

# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = 'your_secret_key'
socketio = SocketIO(app, cors_allowed_origins="*")  # Allow all origins for WebSocket connections

# Initialize PCA9685 Servo Driver
kit = ServoKit(channels=16)

# Store servo angles (start from current position)
servo_angles = {0: kit.servo[0].angle, 1: kit.servo[1].angle, 2: kit.servo[2].angle,
                3: kit.servo[3].angle, 4: kit.servo[4].angle, 5: kit.servo[5].angle}
STEP_ANGLE = 1  # Rotate by 1 degree per detection cycle

# Serve the index.html file from the website folder
@app.route("/")
def serve_index():
    return send_from_directory("website", "index.html")

# Serve static files (CSS, JS, images) from website folder
@app.route("/<path:path>")
def serve_static(path):
    return send_from_directory("website", path)

# WebSocket event handler for gesture updates
@socketio.on('update_gesture')
def handle_gesture(data):
    try:
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

        # Emit the updated servo angles back to the client
        emit('servo_update', servo_angles)

    except Exception as e:
        print(f"Error: {e}")
        emit('error', {"message": str(e)})

if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000, debug=True)

