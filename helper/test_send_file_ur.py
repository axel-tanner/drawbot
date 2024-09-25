import socket

PORT = 30001
HOST = '192.168.125.21'

rapid_ms = 0.25
accel_mss = 0.25

def client():
    s = socket.socket()
    s.connect((HOST, PORT))

    command = b'set_digital_out(2, False)\n'
    command = f'movej([-1.26,-1.19,-2.39,-1.134,1.57,-1.26], {rapid_ms}, {accel_mss}, 0, 0)\n'
    command = 'movel(pose_trans(drawing_plane, p[0.2346, 0.14452, 0.02,0,0,0]), 0.25, v=0.25, t=0, r=0.0005)\n'
    s.send(command.encode())
    received_data = s.recv(1024)
    print(f'{str(received_data)=}')

    s.close()

if __name__ == '__main__':
    client()
