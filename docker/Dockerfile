FROM nginx:alpine

# Install Python + pymupdf for PDF generation at startup
RUN apk add --no-cache python3 py3-pip && \
    pip3 install --break-system-packages pymupdf

# Copy PDF generation script
COPY add_pdf_links_container.py /app/add_pdf_links.py

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy entrypoint
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
