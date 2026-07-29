import os

html_files = ['train.html', 'train_voice_v2.html', 'pose.html']

for html_file in html_files:
    if not os.path.exists(html_file):
        print(f"Skipping {html_file}, not found")
        continue
    
    with open(html_file, 'r', encoding='utf-8') as f:
        content = f.read()

    # We want to replace:
    #                     const xhr = new XMLHttpRequest();
    #                     xhr.open('POST', url, true);
    #                     if (init.headers) {
    # with:
    #                     let bytesSent = 0;
    #                     const xhr = new XMLHttpRequest();
    #                     if (xhr.upload) { xhr.upload.onprogress = (e) => { bytesSent = e.loaded; }; }
    #                     xhr.open('POST', url, true);
    #                     if (init.headers) {

    old_init = """                    const xhr = new XMLHttpRequest();
                    xhr.open('POST', url, true);"""
    
    new_init = """                    let bytesSent = 0;
                    const xhr = new XMLHttpRequest();
                    if (xhr.upload) { xhr.upload.onprogress = (e) => { bytesSent = e.loaded; }; }
                    xhr.open('POST', url, true);"""

    content = content.replace(old_init, new_init)

    # We want to replace:
    #                     xhr.onerror = () => {
    #                         if (url.includes(':8080/upload')) {
    # with:
    #                     xhr.onerror = () => {
    #                         if (url.includes(':8080/upload') && bytesSent > 0) {

    old_err = """                    xhr.onerror = () => {
                        if (url.includes(':8080/upload')) {"""
    
    new_err = """                    xhr.onerror = () => {
                        if (url.includes(':8080/upload') && bytesSent > 0) {"""

    content = content.replace(old_err, new_err)

    with open(html_file, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f"Patched {html_file}")
