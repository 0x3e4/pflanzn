#!/bin/sh
# Writes the real_ip settings from TRUSTED_PROXIES (comma-separated addresses or CIDRs),
# before the nginx image renders the templates (20-envsubst-on-templates.sh).
#
# A request from a trusted address gets its client IP from the right-most X-Forwarded-For
# entry, the one that proxy appended; anything to the left of it is whatever the client sent.
# Requests from anywhere else keep their own address. TRUSTED_PROXIES=none turns it off.
set -eu

out=/etc/nginx/conf.d/00-real-ip.conf
proxies="${TRUSTED_PROXIES:-}"

if [ -z "$proxies" ] || [ "$proxies" = "none" ]; then
    : > "$out"
    echo "15-real-ip.sh: no trusted proxies, client IP is the connecting address"
    exit 0
fi

{
    echo "# Generated from TRUSTED_PROXIES by /docker-entrypoint.d/15-real-ip.sh"
    for entry in $(echo "$proxies" | tr ',' ' '); do
        case "$entry" in
            *[!0-9a-fA-F.:/]*) echo "15-real-ip.sh: ignoring invalid TRUSTED_PROXIES entry '$entry'" >&2 ;;
            *) echo "set_real_ip_from $entry;" ;;
        esac
    done
    echo "real_ip_header X-Forwarded-For;"
    echo "real_ip_recursive off;"
} > "$out"
echo "15-real-ip.sh: trusting X-Forwarded-For from $proxies"
