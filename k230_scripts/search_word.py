import os

def search_in_file(path, query):
    try:
        with open(path, "r") as f:
            for i, line in enumerate(f):
                if query in line:
                    print(f"Match found in {path} (Line {i+1}): {line.strip()}")
    except Exception:
        pass

def scan_and_search(path, query):
    try:
        for entry in os.listdir(path):
            full_path = path + "/" + entry
            try:
                # Check if it's a directory
                os.listdir(full_path)
                scan_and_search(full_path, query)
            except OSError:
                # It's a file
                if entry.endswith(".py"):
                    search_in_file(full_path, query)
    except Exception:
        pass

def main():
    query = "person_kp"
    print(f"=== K230 SD Card Code Search for '{query}' ===")
    scan_and_search("/sdcard", query)
    print("\nSearch completed successfully!")

if __name__ == "__main__":
    main()
