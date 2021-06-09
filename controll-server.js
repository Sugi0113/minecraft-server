'use strict';

const { isFunction } = require('util');

const { exec } = require('child_process'),
    express = require('express'),
    https = require('https'),
    fs = require('fs'),
    request = require('request'),
    MAIN_SERVER_NAME = 'minecraft',
    MAIN_SERVER_ZONE = 'us-central1-a',
    MAIN_SERVER_IP = '10.128.0.2',
    app = express(),
    server = https.createServer({
        key : fs.readFileSync('/etc/letsencrypt/live/sugicraft.cf/privkey.pem'),
        cert : fs.readFileSync('/etc/letsencrypt/live/sugicraft.cf/fullchain.pem')
    }, app),
    watchServer = http.createServer();

String.prototype.bytes = function(){
    return Buffer.from(this).length;
}
function response(res, code, data, head_arg={}, options={}){
try{
    if(!Buffer.isBuffer(data)){
        if(data === void(0)){
            data = 'undefined';
        }else if(data === null){
            data = 'null';
        }else if(data.toString){
            data = data.toString();
        }else{
            data = String(data);
        }
    }
    let header = {
        'Server'        : 'Node.js',
        'Date'          : new Date().toGMTString(),
        'Content-Type'  : 'text/plain',
        'Content-Length': data.bytes().toString(),
        ...head_arg
    };
    switch(options.type){
        case undefined:
            break;
        case 'html':
            header['Content-Type'] = 'text/html; charset=UTF-8';
            break;
        case 'css':
            header['Content-Type'] = 'text/css; charset=UTF-8';
            break;
        case 'js':
            header['Content-Type'] = 'text/javascript; charset=UTF-8';
            break;
        case 'json':
            header['Content-Type'] = 'application/json; charset=UTF-8';
            break;
        default:
            throw new Error(`Unknown Type: ${type}`);
    }
    if(!header['Transfer-Encoding']&&!header['transfer-encoding']){
        res.removeHeader('Transfer-Encoding');
    }
    res.writeHead(code, header);
    res.write(data);
    res.end();
}catch(err){
    res.end();
    throw err;
}
}
        
function httpGET(url){
return new Promise((resolve, reject)=>{
    request.get(url, (err, res, body) => resolve([err, res]));
});
}

function httpPOST(url, body, json=false){
return new Promise((resolve, reject)=>{
    request.post({url, body:json?JSON.stringify(body):body}, (err, res, body) => resolve([err, res])); 
});
}

async function gcpStatus(){
    exec(`gcloud compute instances describe ${MAIN_SERVER_NAME} --zone ${MAIN_SERVER_ZONE} --format=yaml\\(status\\)`, (err, stdout, stderr)=>{
        if(err){
            if(err.errno === 'EHOSTUNREACH' || err.code === 'EHOSTUNREACH') return 'down';
            throw err;
        }
        else if(stderr && stderr.replace(/\s/g, '').length) throw new Error(`stderr:${stderr}`);
        else if(!stdout || !(stdout.replace(/\s/g, '').length)) throw new Error('Unknown Error');
        else return stdout.replace(/^status:/, '').replace(/\s/g, '');
    });
}

async function serverStatus(){
    const [err, res] = await httpGET(`http://${MAIN_SERVER_IP}/status`), {statusCode, body} = res;
    if(err) throw err;
    if(statusCode === 200) return body;
    else throw new Error(`code:${statusCode}\nbody:${body}`);
}

app.use(express.static('./public'));
let status = 'off';
watchServer.on('request', (req, res)=>{
    if(req.url === '/ok') status = 'ok';
    else if(req.url === '/shutdown'){
        status = 'shutdown';
        getStatusIntv = setInterval(async ()=>{
            const s = await gcpStatus();
            if(s === 'TERMINATED'){
                status = 'off';
                clearInterval(this);
                getStatusIntv = undefined;
            }
        }, 1000);
    } else if(req.url === '/reset') status = 'reset';
    else if(req.url === '/idle'){
        const arr = [];
        req.on('data', chunk => arr.push(chunk));
        req.on('end', ()=>{
            const body = Buffer.concat(arr);
            idleSince = parseInt(body);
        });
    }
    response(res, 200, 'ACK');
});
watchServer.listen(8080);
async function getStatus(){
    const s = await gcpStatus();
    //PROVISIONING, STAGING, RUNNING, STOPPING, TERMINATED
    if(s === 'RUNNING'){
        const body = await serverStatus();
        status = body;
    } else if(s === 'PROVISIONING' || s === 'STAGING') status = 'launch';
    else if(s === 'STOPPING') status = 'shutdown';
    else if(s === 'TERMINATED') status =  'off';
    else {
        status = 'err';
        throw new Error(`s:${s}`);
    }
}
status = await getStatus();
app.use('/api/status', async (req, res)=>{
    response(res, 200, status);
});

app.post('/api/launch', (req, res)=>{
    let end = false;
    exec(`gcloud compute instances start ${MAIN_SERVER_NAME} --zone ${MAIN_SERVER_ZONE}`, (err, stdout, stderr) => {
        if(err){
            if(!end) response(res, 500, err.stack||err.toString());
            end = true;
            console.error(err);
        }
    }).stderr.on('data', () => {
        if(!end){
            end = true;
            status = 'launch';
            response(res, 200, 'done');
        }
    });
});

app.get('/api/onlineUsers', (req, res)=>{
    const [err, res2] = await httpGET(`http://${MAIN_SERVER_IP}/onlineUsers`), {statusCode, body} = res2;
    if(err) response(res, 500, err);
    else response(res, statusCode, body);
});

app.post('/api/off', (req, res) => {
    const [err, res2] = await httpPOST(`http://${MAIN_SERVER_IP}/off`, ''), {statusCode, body} = res2;
    if(err) response(res, 500, err);
    else response(res, statusCode, body);
});

app.post('/api/softreset', (req, res) => {
    const [err, res2] = await httpPOST(`http://${MAIN_SERVER_IP}/softreset`, ''), {statusCode, body} = res2;
    if(err) response(res, 500, err);
    else response(res, statusCode, body);
});
app.post('/api/hardreset', (req, res) => {
    const [err, res2] = await httpPOST(`http://${MAIN_SERVER_IP}/hardreset`, ''), {statusCode, body} = res2;
    if(err) response(res, 500, err);
    else response(res, statusCode, body);
});
server.listen(443);