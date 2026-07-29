# Stage 1: Build the Expo Web app
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy application files
COPY . .

# Build the web bundle (outputs to 'dist')
RUN npm run build

# Stage 2: Serve the app using Nginx
FROM nginx:alpine

# Copy the built web assets from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Explicitly copy all Blockly's static assets (css, js, icons, sounds, models, offline_libs, etc.)
# to ensure the latest versions of all assets are served.
COPY --from=builder /app/assets/blockly /usr/share/nginx/html/assets/blockly

# Copy the general assets/img (like ben10.jpeg avatar) to the expected blockly assets img folder
COPY --from=builder /app/assets/img /usr/share/nginx/html/assets/blockly/assets/img

# Directly overwrite all Expo-hashed Blockly HTML editors with our latest modified sources.
# Expo's Metro bundler caches the asset hash from the original file registration,
# so the dist copy always contains stale content. This RUN instruction dynamically
# finds and updates all hashed versions of the HTML files.
RUN cd /usr/share/nginx/html/assets/blockly && \
    (for f in index.*.html; do [ -f "$f" ] && [ "$f" != "index.html" ] && cp index.html "$f"; done || true) && \
    (for f in pose.*.html; do [ -f "$f" ] && [ "$f" != "pose.html" ] && cp pose.html "$f"; done || true) && \
    (for f in train.*.html; do [ -f "$f" ] && [ "$f" != "train.html" ] && cp train.html "$f"; done || true) && \
    (for f in train_picker.*.html; do [ -f "$f" ] && [ "$f" != "train_picker.html" ] && cp train_picker.html "$f"; done || true) && \
    (for f in train_voice_v2.*.html; do [ -f "$f" ] && [ "$f" != "train_voice_v2.html" ] && cp train_voice_v2.html "$f"; done || true)

# Copy the Nginx template which natively supports $PORT
COPY default.conf.template /etc/nginx/templates/default.conf.template

# Cloud Run injects $PORT (usually 8080). Default to 8080 if not set.
ENV PORT=8080
EXPOSE $PORT

# Start Nginx normally (it automatically processes templates)
CMD ["nginx", "-g", "daemon off;"]
