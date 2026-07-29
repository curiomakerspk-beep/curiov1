def read_and_print(path):
    print(f"\n=======================================================")
    print(f"Reading file: {path}")
    print(f"=======================================================")
    try:
        with open(path, "r") as f:
            for line in f:
                # print line directly without extra newline
                print(line, end="")
    except Exception as e:
        print(f"Error reading {path}: {e}")
    print(f"\n=======================================================\n")

def main():
    # Read main.py
    read_and_print("/sdcard/main.py")

if __name__ == "__main__":
    main()
