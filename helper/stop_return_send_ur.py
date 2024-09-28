import socket
import time

PORT = 30001
HOST = '192.168.125.21'

rapid_ms = 0.25
accel_mss = 0.25

def client():
    s = socket.socket()
    s.connect((HOST, PORT))

    command = f'stopl({accel_mss})\n'
    s.send(command.encode())
    received_data = s.recv(1024)
    time.sleep(1)
    command = f'movej([-1.26,-1.19,-2.39,-1.134,1.57,-1.26], {rapid_ms}, {accel_mss}, 0, 0)\n'
    s.send(command.encode())
    received_data = s.recv(1024)

    s.close()

if __name__ == '__main__':
    client()
