import aidemo

def main():
    print("=== Kendryte K230 aidemo Module Inspection ===")
    try:
        attrs = dir(aidemo)
        print("Attributes in aidemo:")
        for attr in attrs:
            print(" -", attr)
    except Exception as e:
        print("Error inspecting aidemo:", e)

if __name__ == "__main__":
    main()
