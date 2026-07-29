import os

def list_recursive(path, indent=0):
    try:
        entries = os.listdir(path)
        for entry in entries:
            full_path = path + "/" + entry
            try:
                # Check if it's a directory
                os.listdir(full_path)
                print("  " * indent + f"📁 {entry}/")
                list_recursive(full_path, indent + 1)
            except OSError:
                # It's a file
                size = os.stat(full_path)[6]
                print("  " * indent + f"📄 {entry} ({size} bytes)")
    except Exception as e:
        print("  " * indent + f"Error reading {path}: {e}")

def main():
    print("=== Kendryte K230 Complete SD Card File Tree ===")
    list_recursive("/sdcard")
    print("\nScan completed successfully!")

if __name__ == "__main__":
    main()
