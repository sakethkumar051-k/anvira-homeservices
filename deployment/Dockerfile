# Standalone API image; the website is built separately by Vercel.
# No Firebase Functions or paid Firebase plan is required to run this API.
FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
COPY patches ./patches
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY server ./server
RUN rm -f server/*.sqlite* && mkdir -p /var/lib/anvira/documents && chown -R node:node /var/lib/anvira
USER node
ENV NODE_ENV=production APP_MODE=firebase PAYMENT_MODE=razorpay PORT=4000 RUN_BACKGROUND_JOBS=true
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server/index.mjs"]
