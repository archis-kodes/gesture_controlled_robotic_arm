from flask import Flask, send_from_directory
from flask_socketio import SocketIO, emit
from flask import request  # Explicitly import request
import serial
import time
from datetime import datetime
from colorama import init, Fore, Back, Style

# Initialize colorama
init(autoreset=True)


# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = 'your_secret_key'
socketio = SocketIO(app, cors_allowed_origins="*")

# Initialize serial connection to Arduino
try:
    arduino = serial.Serial('/dev/ttyACM0', 9600)  # Linux/Mac
    # arduino = serial.Serial('COM3', 9600)        # Windows
    time.sleep(2)  # Allow time for connection to stabilize
    print(Fore.GREEN + "✓ Arduino connected successfully")
except Exception as e:
    print(Fore.RED + f"✗ Arduino connection failed: {e}")
    arduino = None

# Track previous command
prev_command = None

def log_received_data(data):
    timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
    print(f"\n{Fore.CYAN}╔═══════════════════════════════════")
    print(f"{Fore.CYAN}║ {Fore.YELLOW}📥 Received Data @ {timestamp}")
    print(f"{Fore.CYAN}╠───────────────────────────────────")
    print(f"{Fore.CYAN}║ {Fore.WHITE}Command: {Fore.GREEN}{data.get('command', 'None')}")
    print(f"{Fore.CYAN}╚═══════════════════════════════════")

def log_serial_send(command):
    timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
    print(f"{Fore.MAGENTA}╔► {Fore.BLUE}SERIAL {Fore.WHITE}@ {timestamp}")
    print(f"{Fore.MAGENTA}║  Sending: {Fore.GREEN}{command}")
    print(f"{Fore.MAGENTA}╚═{'═'*30}")

@app.route("/")
def serve_index():
    return send_from_directory("website", "index.html")

@app.route("/<path:path>")
def serve_static(path):
    return send_from_directory("website", path)

@socketio.on('connect')
def handle_connect():
    client_ip = request.remote_addr or request.environ.get('REMOTE_ADDR', 'unknown')
    print(Fore.GREEN + f"\n★ Client connected from {client_ip}")

@socketio.on('disconnect')
def handle_disconnect():
    print(Fore.YELLOW + "\n★ Client disconnected")

@socketio.on('update_gesture')
def handle_gesture(data):
    global prev_command
    
    try:
        command = data.get("command", "A").upper().strip()
        valid_commands = "ABCDEFGHIJKLM"
        
        # Log received data with visualization
        log_received_data(data)
        
        # Validate command
        if command not in valid_commands:
            command = "A"
            print(Fore.RED + f"⚠️  Invalid command received, defaulting to 'A'")

        # Only send if command changed and Arduino is connected
        if command != prev_command:
            if arduino is not None:
                arduino.write(f"{command}\r\n".encode())
                log_serial_send(command)
                prev_command = command
                
                emit('uart_response', {
                    "status": "success",
                    "message": f"Sent: {command}"
                })
            else:
                print(Fore.RED + "⚠️  Arduino not connected - command not sent")
                emit('error', {"message": "Arduino not connected"})
        else:
            print(Fore.YELLOW + "🔄 Command unchanged (not resent)")
            emit('uart_response', {
                "status": "no_change",
                "message": f"Command unchanged: {command}"
            })

    except Exception as e:
        print(Fore.RED + f"🔥 Error: {e}")
        emit('error', {"message": str(e)})

if __name__ == "__main__":
    print(Fore.CYAN + "\n═══════════════════════════════════")
    print(Fore.CYAN + "   Gesture Control Server Started")
    print(Fore.CYAN + "═══════════════════════════════════\n")
    socketio.run(app, host="0.0.0.0", port=5000, debug=True)
