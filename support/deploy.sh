#!/usr/bin/env bash
if [ $1 = "ssh" ]; then ssh $RODEO_SSH; exit 0; fi;
if [ $1 = "logs" ]; then ssh $RODEO_SSH "tail -n 250 -f worker.log"; exit 0; fi;
npx pkg --targets latest-linuxstatic-x64 --compress Brotli -o /tmp/worker support/worker.js
scp /tmp/worker $RODEO_SSH:worker
