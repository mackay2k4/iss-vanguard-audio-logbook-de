#!/bin/sh
# Configure nginx and generate PDF based on ISS_VANGUARD_HOSTNAME

HOSTNAME="${ISS_VANGUARD_HOSTNAME:-localhost}"
PORT="${ISS_VANGUARD_PORT:-8080}"

# Build BASE_URL (skip port for standard https/443)
if [ "$PORT" = "443" ] || [ "$PORT" = "80" ]; then
    BASE_URL="https://${HOSTNAME}/play"
else
    BASE_URL="http://${HOSTNAME}:${PORT}/play"
fi

echo "=== ISS Vanguard Audio Server ==="
echo "  Hostname: $HOSTNAME"
echo "  Port: $PORT"
echo "  Base URL: $BASE_URL"

# Update nginx server_name
sed -i "s|server_name .*;|server_name ${HOSTNAME};|" /etc/nginx/conf.d/default.conf

# Generate PDF with play links
if [ -f /app/add_pdf_links.py ] && [ -f /data/import/DE_ISS_Vanguard_Logbuch_links_boxV1-1.pdf ]; then
    echo "  Generating PDF..."
    ISS_VANGUARD_BASE_URL="$BASE_URL" python3 /app/add_pdf_links.py
    echo "  PDF ready."
else
    echo "  Using existing PDF (source PDF or script missing)"
fi

echo "  Starting nginx..."
exec nginx -g 'daemon off;'
