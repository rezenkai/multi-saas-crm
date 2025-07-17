# Temporary placeholder Marketing service
FROM node:18-alpine

WORKDIR /app

# Create a simple placeholder service
RUN echo 'const express = require("express"); const app = express(); const PORT = process.env.SERVICE_PORT || 8007; app.get("/health", (req, res) => res.json({ status: "ok", service: "marketing-service" })); app.listen(PORT, () => console.log(`Marketing Service running on port ${PORT}`));' > server.js

# Install express
RUN npm init -y && npm install express

EXPOSE 8007

CMD ["node", "server.js"]