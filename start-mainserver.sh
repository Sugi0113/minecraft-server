#!/bin/bash
while :; do node main-server.js 2>>err/node || break; done
after.sh