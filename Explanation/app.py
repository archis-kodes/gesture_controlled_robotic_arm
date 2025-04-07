# Import necessary libraries
from flask import Flask, send_from_directory  # Flask web framework
from flask_socketio import SocketIO, emit    # WebSocket functionality
from flask import request                    # For handling HTTP requests
import serial                                # For serial communication with Arduino
import time                                  # For time-related functions
from datetime import datetime                # For timestamping
from colorama import init, Fore, Back, Style # For colored console output

# Initialize colorama for colored terminal output
init(autoreset=True)

# Create Flask application instance
app = Flask(__name__)
# Set a secret key for session security
app.config['SECRET_KEY'] = 'your_secret_key'
# Initialize SocketIO with CORS enabled for all origins
socketio = SocketIO(app, cors_allowed_origins="*")

# Try to establish serial connection with Arduino
try:
    # Linux/Mac serial port (comment out the Windows one if using Linux/Mac)
    arduino = serial.Serial('/dev/ttyACM0', 9600)
    # Windows serial port (uncomment if using Windows)
    # arduino = serial.Serial('COM3', 9600)
    # Wait 2 seconds for connection to stabilize
    time.sleep(2)
    # Print success message in green
    print(Fore.GREEN + "✓ Arduino connected successfully")
except Exception as e:
    # Print error message in red if connection fails
    print(Fore.RED + f"✗ Arduino connection failed: {e}")
    # Set arduino to None if connection fails
    arduino = None

# Variable to store the previous command sent to Arduino
prev_command = None

# Function to log received data with visual formatting
def log_received_data(data):
    # Get current timestamp with milliseconds
    timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
    # Print formatted log header
    print(f"\n{Fore.CYAN}╔═══════════════════════════════════")
    # Print timestamp
    print(f"{Fore.CYAN}║ {Fore.YELLOW}📥 Received Data @ {timestamp}")
    # Print separator
    print(f"{Fore.CYAN}╠───────────────────────────────────")
    # Print the received command
    print(f"{Fore.CYAN}║ {Fore.WHITE}Command: {Fore.GREEN}{data.get('command', 'None')}")
    # Print footer
    print(f"{Fore.CYAN}╚═══════════════════════════════════")

# Function to log serial commands being sent
def log_serial_send(command):
    # Get current timestamp with milliseconds
    timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
    # Print formatted header
    print(f"{Fore.MAGENTA}╔► {Fore.BLUE}SERIAL {Fore.WHITE}@ {timestamp}")
    # Print the command being sent
    print(f"{Fore.MAGENTA}║  Sending: {Fore.GREEN}{command}")
    # Print footer
    print(f"{Fore.MAGENTA}╚═{'═'*30}")

# Route to serve the main HTML page
@app.route("/")
def serve_index():
    # Serve index.html from the "website" directory
    return send_from_directory("website", "index.html")

# Route to serve static files (CSS, JS, etc.)
@app.route("/<path:path>")
def serve_static(path):
    # Serve any file from the "website" directory
    return send_from_directory("website", path)

# WebSocket event handler for client connections
@socketio.on('connect')
def handle_connect():
    # Get client IP address
    client_ip = request.remote_addr or request.environ.get('REMOTE_ADDR', 'unknown')
    # Print connection message in green
    print(Fore.GREEN + f"\n★ Client connected from {client_ip}")

# WebSocket event handler for client disconnections
@socketio.on('disconnect')
def handle_disconnect():
    # Print disconnection message in yellow
    print(Fore.YELLOW + "\n★ Client disconnected")

# WebSocket event handler for gesture updates
@socketio.on('update_gesture')
def handle_gesture(data):
    # Access the global previous command variable
    global prev_command
    
    try:
        # Get command from data, default to "A", convert to uppercase, and strip whitespace
        command = data.get("command", "A").upper().strip()
        # Define valid commands
        valid_commands = "ABCDEFGHIJKLM"
        
        # Log the received data
        log_received_data(data)
        
        # Validate the command
        if command not in valid_commands:
            # If invalid, default to "A" and print warning
            command = "A"
            print(Fore.RED + f"⚠️  Invalid command received, defaulting to 'A'")

        # Only proceed if command is different from previous
        if command != prev_command:
            # Check if Arduino is connected
            if arduino is not None:
                # Send command to Arduino with newline and carriage return
                arduino.write(f"{command}\r\n".encode())
                # Log the sent command
                log_serial_send(command)
                # Update previous command
                prev_command = command
                
                # Send success response to client
                emit('uart_response', {
                    "status": "success",
                    "message": f"Sent: {command}"
                })
            else:
                # Print warning if Arduino not connected
                print(Fore.RED + "⚠️  Arduino not connected - command not sent")
                # Send error to client
                emit('error', {"message": "Arduino not connected"})
        else:
            # Print message if command unchanged
            print(Fore.YELLOW + "🔄 Command unchanged (not resent)")
            # Send no-change response to client
            emit('uart_response', {
                "status": "no_change",
                "message": f"Command unchanged: {command}"
            })

    except Exception as e:
        # Print any errors in red
        print(Fore.RED + f"🔥 Error: {e}")
        # Send error to client
        emit('error', {"message": str(e)})

# Main entry point
if __name__ == "__main__":
    # Print startup banner
    print(Fore.CYAN + "\n═══════════════════════════════════")
    print(Fore.CYAN + "   Gesture Control Server Started")
    print(Fore.CYAN + "═══════════════════════════════════\n")
    # Start the SocketIO server
    socketio.run(app, host="0.0.0.0", port=5000, debug=True)
