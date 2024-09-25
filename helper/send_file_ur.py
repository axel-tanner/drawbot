import socket
import time

PORT = 30001
HOST = '192.168.125.21'

# rapid_ms = 0.25
# accel_mss = 0.25
# blend_radius_m = 0.0004
feature = 'drawing_plane'

script_file = '/Users/axel/Library/Mobile Documents/com~apple~CloudDocs/Downloads/drawing.script'

def client(lines):
    s = socket.socket()
    s.connect((HOST, PORT))

    command = ''.join(lines).encode()
    print(command)
    s.send(command)

    # for l in lines:
    #     command = l.encode()
    #     print(command)
    #     s.send(command)
    #     received_data = s.recv(1024)
    #     # print(received_data)
    #     time.sleep(0.4)

    s.close()

if __name__ == '__main__':

    # read script file
    with open(script_file, 'r') as inp:
        script_lines = inp.readlines()

#     script_lines = ['movej([-1.26,-1.19,-2.39,-1.134,1.57,-1.26], 0.25, 0.25, 0, 0)\n',
# #   'sleep(1)\n',
# #   '#movel(pose_trans(drawing_plane, p[0.2346, 0.14452, 0.02,0,0,0]), 0.25, v=0.25, t=0, r=0.0005)\n',
#   'movej([-1.20,-1.19,-2.39,-1.134,1.57,-1.26], 0.25, 0.25, 0, 0)\n']

    client(script_lines)
