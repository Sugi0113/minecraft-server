#!/bin/bash
while :; do node /home/sugi/git/minecraft-server/main-server.js >>/home/sugi/git/minecraft-server/log/node 2>>/home/sugi/git/minecraft-server/err/node || break; done
/home/sugi/git/minecraft-server/after.sh