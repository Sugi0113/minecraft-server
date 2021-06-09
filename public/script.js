var status = undefined, stIntv, stIntvN;
function error(s){
    alert('エラーだよ、すぎに伝えてね\n' + s);
}
function setStatusIntv(n){
    stIntvN = n;
    clearInterval(stIntv);
    stIntv = setInterval(getStatus, n*1000);
}
function get(url){
    return new Promise(function(resolve, reject){
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url);
        xhr.onreadystatechange = function(){
            if(xhr.readyState === XMLHttpRequest.DONE) resolve(xhr.responseText);
        };
        xhr.send();
    });
}
function post(url, data=''){
    return new Promise(function(resolve, reject){
        var xhr = new XMLHttpRequest();
        xhr.open('POST', url);
        xhr.onreadystatechange = function(){
            if(xhr.readyState === XMLHttpRequest.DONE) resolve(xhr.responseText);
        };
        xhr.send(data);
    });
}
function setBtnClickable(clickable, startOnly=false){
    document.getElementById('startstop').disbled = !clickable;
    document.getElementById('hardreset').disbled = startOnly&&!clickable;
    document.getElementById('hardreset').disbled = startOnly&&!clickable;
}
function getStatus(){
return new Promise(function(resolve, reject){
    var elm = document.getElementById('status');
    get('/api/status').then(function(body){
        var s, err;
        status = 'ok';
        switch(body){
            case 'ok':
                if(stIntvN !== 5) setStatusIntv(5);
                s = '動作中';
                get('/api/idleSince').then(function(idleSince){
                    idleSince = parseInt(idleSince);
                    if(idleSince) s += '\n(あと' + Math.round((Date.now()-idleSince)/60/1000) + '分で自動停止)';
                    elm.innerText = s;
                    s = undefined;
                });
                document.getElementById('startstop').innerText = '停止';
                setBtnClickable(true);
            break;
            case 'shutdown':
                s = 'シャットダウン中';
            break;
            case 'off':
                if(stIntvN !== 5) setStatusIntv(5);
                s = '停止中';
                setBtnClickable(true, true);
            break;
            case 'launch':
                s = '起動中';
            break;
            case 'reset':
                s = '再起動中';
            break;
            default:
                s = '不明';
                error('status, body='+body);
                setBtnClickable(true);
            break;
        }
        if(s) elm.innerText = s;
        document.getElementById('startstop').innerText = '起動';
        resolve(s);
    });
});
}
function getOnlineUsers(){
    if(status !== 'ok') return;
    var elm = document.getElementById('onlineusers');
    get('/api/onlineUsers').then(function(body){
        elm.innerText = '現在オンラインのユーザー: ' + body;
    });
}
document.addEventListener('DOMContentLoaded', function(){
    getStatus();
    getOnlineUsers();
    setInterval(getOnlineUsers, 5000);
    setStatusIntv(5);
    document.getElementById('startstop').addEventListener('click',function(){
        if(!confirm(this.innerText + 'しますか？')) return;
        setStatusIntv(2);
        if(this.innerText === '起動'){
            post('/api/launch').then(function(body){
                if(body === 'done') setBtnClickable(false);
                else error('launch, body='+body);
            });
        } else {post('/api/off').then(function(body){
            if(body === 'done') setBtnClickable(false);
                else error('off, body='+body);
            });
        }
    });
    document.getElementById('softreset').addEventListener('click',function(){
        if(!confirm('再起動しますか？')) return;
        setStatusIntv(2);
        post('/api/softreset').then(function(body){
            if(body === 'done') setBtnClickable(false);
            else error('softreset, body='+body);
        });
    });
    document.getElementById('hardreset').addEventListener('click',function(){
        if(!confirm('再起動しますか？')) return;
        setStatusIntv(2);
        post('/api/hardreset').then(function(body){
            if(body === 'done') setBtnClickable(false);
            else error('hardreset, body='+body);
        });
    });
});