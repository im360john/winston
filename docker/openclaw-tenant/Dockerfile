# Winston Tenant Container
# Wraps OpenClaw with sidecar API for live file management
# OpenClaw remains 100% vanilla and unmodified

FROM node:20-alpine

# Install OpenClaw (vanilla, unmodified)
# TODO: Replace with actual OpenClaw installation method
# This is a placeholder - adjust based on OpenClaw's actual installation
RUN npm install -g openclaw || echo "OpenClaw install pending"

# Install sidecar dependencies
WORKDIR /winston
COPY package.json /winston/package.json
RUN npm install --production

# Add Winston components (wrapping layer only)
COPY sidecar.js /winston/sidecar.js
COPY entrypoint.sh /winston/entrypoint.sh
RUN chmod +x /winston/entrypoint.sh

# Create data directory for persistent volume
RUN mkdir -p /data

# Expose ports
# 18789 - OpenClaw gateway (standard)
# 18790 - Winston sidecar API
EXPOSE 18789 18790

# Use our entrypoint (starts both OpenClaw + sidecar)
ENTRYPOINT ["/winston/entrypoint.sh"]
