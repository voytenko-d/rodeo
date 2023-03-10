npx pkg --targets latest-linuxstatic-x64 --compress Brotli -o /tmp/worker support/worker.js
scp /tmp/worker $RODEO_SSH:worker
