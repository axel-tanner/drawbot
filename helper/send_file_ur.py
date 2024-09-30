import socket
import argparse
import shutil
import datetime
import os

parser = argparse.ArgumentParser(description='Send URScript file to UR10 robot')
parser.add_argument('-i', '--input_file', type=str, help='input file with URScript code', required=False)

args = parser.parse_args()

PORT = 30001
HOST = '192.168.125.21'
DEFAULT_PATH = '/Users/axel/Library/Mobile Documents/com~apple~CloudDocs/Downloads/'
DEFAULT_FILE = 'drawing.script'

if not args.input_file:
    script_file = DEFAULT_PATH + DEFAULT_FILE
else:
    if '/' in args.input_file:
        # take as absolute path
        script_file = args.input_file
    else:
        # take as file in DEFAULT_PATH
        script_file = DEFAULT_PATH + args.input_file

# check if file exists
if not os.path.isfile(script_file):
    print(f'ERROR: File {script_file} does not exist!')
    exit(1)

print(f'Using as input: {script_file=}')

# create a backup copy of the file
backup_file = script_file + '.' + datetime.datetime.now().strftime('%Y%m%dT%H%M%S')
print(f'creating backup as {backup_file}')
shutil.copy2(script_file, backup_file)

def client(lines):
    s = socket.socket()
    s.connect((HOST, PORT))

    command = ''.join(lines).encode()
    # print(command)
    s.send(command)
    received_data = s.recv(1024)  # recommended in UR script docs: to read something

    s.close()

if __name__ == '__main__':

    # read script file
    with open(script_file, 'r') as inp:
        script_lines = inp.readlines()

    client(script_lines)
