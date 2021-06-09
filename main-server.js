const { exec } = require('child_process'),
    http = require('http'),
    fs = require('fs'),
    request = require('request'),
    server = http.createServer(),
    CONTROLL_SERVER_IP = '10.138.0.2',
    IDLE_TIMEOUT = 5 * 60 * 1000;
let bedrockProcess, quit = false, reset = false, hardreset = false, launch = true, err, onlineUsers = [], idleTimeout, idleSince=0;

function timeSting(){
    const now = new Date();
    return `${now.getUTCFullYear()}-${now.getUTCMonth()+1}-${now.getUTCDate()}_${now.getUTCHours()}-${now.getUTCMinutes()}-${now.getUTCSeconds()}`;
}

function resp(res, code, body){
    res.removeHeader('Content-Encoding');
    res.writeHead(code);
    res.write(body);
    res.end();
}

server.on('request', (req, res)=>{
    if(req.method.toUpperCase() === 'GET'){
        if(req.url === '/status'){
            if(err) resp(res, 200, err);
            else if(launch) resp(res, 200, 'launch');
            else if(reset) resp(res, 200, 'reset');
            else if(quit) resp(res, 200, 'shutdown');
            else resp(res, 200, 'ok');
        } else if(req.url === '/onlineUsers') resp(res, 200, onlineUsers.join(', '));
        else if(req.url === '/idleSince') resp(res, 200, idleSince+'');
        else resp(res, 400, 'Bad URL');
    } else if(req.method.toUpperCase() === 'POST'){
        if(req.url === '/off'){
            quit = true;
            try{
                bedrockProcess.kill('SIGQUIT');
                resp(res, 200, 'done');
                request.post({url:`http://${CONTROLL_SERVER_IP}/shutdown`, body:''});
            }catch(err){
                resp(res, 500, err.stack);
            }
        } else if(req.url === '/softreset' || req.url === '/hardreset'){
            reset = true;
            hardreset = (req.url === '/hardreset');
            try{
                bedrockProcess.kill('SIGQUIT');
                resp(res, 200, 'done');
                request.post({url:`http://${CONTROLL_SERVER_IP}/reset`, body:''});
            }catch(err){
                resp(res, 500, err.stack);
            }
        } else resp(res, 400, 'Bad URL');
    } else resp(res, 400, 'Bad Method');
});

server.listen(80);
function startBedrock(){
    onlineUsers = [];
    bedrockProcess = exec(`./start-bedrock.sh | tee log/bedrock/${timeSting()}`);
    bedrockProcess.stdout.on('data', stdout => {
        const rowArr = stdout.split(/\n/g);
        for(const row of rowArr){
            if(row === '[INFO] Server started.') {
                launch = false;
                reset = false;
                request.post({url:`http://${CONTROLL_SERVER_IP}/ok`, body:''});
            } else if(row.match(/^\[INFO\] Player connected:/)){
                clearTimeout(idleTimeout);
                idleSince = 0;
                request.post({url:`http://${CONTROLL_SERVER_IP}/idle`, body:'0'});
                clearTimeout(idleTimeout);
                onlineUsers.push(row.replace(/^\[INFO\] Player connected: /, '').match(/[^\,]+/)[0]);
            }
            else if(row.match(/^\[INFO\] Player disconnected: /)){
                onlineUsers.splice(row.replace(/^\[INFO\] Player disconnected: /, '').match(/[^\,]+/)[0], 1);
                if(!onlineUsers.length){
                    idleSince = Date.now();
                    request.post({url:`http://${CONTROLL_SERVER_IP}/idle`, body:idleSince+''});
                    idleTimeout = setTimeout(()=>{
                        quit = true;
                        bedrockProcess.kill('SIGQUIT');
                        request.post({url:`http://${CONTROLL_SERVER_IP}/shutdown`, body:''});
                    }, IDLE_TIMEOUT);
                }
            }
        }
    });
    
    bedrockProcess.on('exit', ()=>{
        if(quit || hardreset){
            const data = `./after.sh', '#!/bin/bash\ninit ${(quit && !hardreset)?'0':'6'}`;
            fs.writeFile('./after.sh', data, (err)=>{
                if(err) throw err;
                process.exit(0);
            });
        } else {
            if(!reset) console.error('Bedrock exited unexpectedly');
            startBedrock();
        }
    });
}
startBedrock();