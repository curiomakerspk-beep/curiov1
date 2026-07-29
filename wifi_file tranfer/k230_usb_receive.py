"""
k230_usb_receive.py - Runs on the Kendryte K230 via CanMV IDE

This script listens on the USB Serial port for file transfers from the PC.
It decodes Base64 chunks and writes them directly to the SD card.
"""

import sys
import os
import ubinascii

SAVE_DIR = '/sdcard'

def ensure_dir(d):
    try:
        os.mkdir(d)
    except OSError:
        pass

def main():
    ensure_dir(SAVE_DIR)
    print("READY_FOR_USB_TRANSFER")

    while True:
        try:
            line = sys.stdin.readline().strip()
            if not line:
                continue

            if line.startswith("START_TRANSFER:"):
                parts = line.split(":")
                filename = parts[1]
                filesize = parts[2]

                filepath = SAVE_DIR + "/" + filename
                print("READY") # Tell PC to start sending data

                with open(filepath, 'wb') as f:
                    while True:
                        data_line = sys.stdin.readline().strip()
                        if data_line == "EOF":
                            break
                        elif data_line.startswith("DATA:"):
                            b64_data = data_line[5:]
                            try:
                                raw_bytes = ubinascii.a2b_base64(b64_data)
                                f.write(raw_bytes)
                                print("ACK")
                            except Exception as e:
                                print("ERR:Base64 decode failed")
                                break
                        else:
                            print("ERR:Unexpected data format")
                            break

                print("SUCCESS")

        except Exception as e:
            print("ERR:" + str(e))

if __name__ == "__main__":
    main()
