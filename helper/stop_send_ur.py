import socket

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
    # print(f'{str(received_data)=}')

    s.close()

if __name__ == '__main__':
    client()
