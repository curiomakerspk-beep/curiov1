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
    # Read AIBase.py first
    read_and_print("/sdcard/libs/AIBase.py")
    
    # Read AI2D.py second
    read_and_print("/sdcard/libs/AI2D.py")

if __name__ == "__main__":
    main()
