import os

def scan_dir(path):
    try:
        for entry in os.listdir(path):
            full_path = path + "/" + entry
            try:
                # Check if it's a directory by attempting listdir
                os.listdir(full_path)
                scan_dir(full_path)
            except OSError:
                # It's a file
                if entry.endswith(".kmodel"):
                    print("Found Model:", full_path)
    except Exception:
        pass

def main():
    print("=== Kendryte K230 SD Card Kmodel Scanner ===")
    print("Scanning for all pre-installed .kmodel files...")
    
    # Common search directories
    search_dirs = ["/sdcard", "/sdcard/examples", "/sdcard/app", "/sdcard/kmodel"]
    
    for d in search_dirs:
        try:
            os.stat(d)
            print(f"\nScanning directory: {d}")
            scan_dir(d)
        except OSError:
            pass
            
    print("\nScan completed successfully!")

if __name__ == "__main__":
    main()
