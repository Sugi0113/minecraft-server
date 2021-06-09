#!/bin/bash
while :; do node /home/sugi/git/minecraft-server/main-server.js 2>>/home/sugi/git/minecraft-server/err/node || break; done
/home/sugi/git/minecraft-server/after.sh