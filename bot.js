/* IRC SETTNGS */
var nick        = 'b4ckspace';
var realname    = 'b4ckspace';
var username    = 'b4ckspace';
var irc_server  = '127.0.0.1';
var irc_port    = 7666;
var ircpass     = undefined;
var secure      = false;
var ignoreSsl   = false;
var channels    = ['#backspace'];
var statusTime  = 1*60*1000; 

/*MPD SETTINGS*/
var mpd_host    = '10.1.20.5';
var mpd_port    = '6600';

var plenkingWait = 30*60*1000;//30min


var irc         = require('irc');
var util        = require('util');
var http        = require('http');
var mpdSocket   = require('mpdsocket');
var mpd;
var lastStatusData  = false;
var wasOpen     = undefined;
var topics      = {};

/*IRC SETUP*/
var ircclient   = new irc.Client( irc_server, nick, {
    'channels'      : channels,
    'userName'      : username,
    'realName'      : realname,
    'port'          : irc_port,
    'secure'        : secure,
    'selfSigned'    : ignoreSsl,
    'certExpired'   : ignoreSsl,
    'password'      : ircpass,
});

ircclient.addListener('message', function (from, to, message) {
    if(from!=nick){
        messageDispatcher(message, from, to);
    }
    if(isChannel(from, to) && (from!=nick) ){
        contentFilter(message, from, to)
    }
});
ircclient.addListener('error', function(message){
    console.log('ERROR: ' + util.inspect(message));
});
ircclient.addListener('topic', function (channel, topic, nick, message){
    topics[channel] = topic;
});

/* MPD SETUP*/
var mpdInit = function(){
    console.log("mpd (re) connect");
    mpd = new mpdSocket(mpd_host, mpd_port);
    mpd.on('close', function(){
        console.log("mpd socket closed.");
        mpdInit();
    });
    mpd.on('error', function(){
        console.log("mpd socket error");
        setTimeout(mpdInit, 10000);
    });
};
mpdInit();

/*code*/
var messageDispatcher = function(message, sender, to){
    var args    = message.split(' ');
    var command = args[0];
    
    switch(command){
        case '!ping':
            commands.pong(sender, to);
        break;
        case '!np':
            commands.playing(sender, to);
        break;
        case '!status':
            commands.status(sender, to);
        break;
        case '!help':
            commands.help(sender, to);
        break;
        case '!add':
            commands.add(sender, to, args[1]);
        break;
        case '!play':
            commands.play(sender, to, args[1]);
        break;
    };
};

var contentFilter = function(message, sender, channel){
    for(var name in Filters){
        Filters[name](message, sender, channel);
    }
};

var sendToWho = function(sender, to){
    return isChannel(sender, to) ? to : sender;
};

var isChannel = function(sender, to){
    return to[0]=='#';
};

var ircColors = {
    red : function(text){
        return irc.colors.wrap('dark_red', text);
    },
    green : function(text){
        return irc.colors.wrap('light_green', text);
    },
};

var updateSpaceStatus = function(){
    console.log("update status");
    var options = {
        host: 'status.bckspc.de',
        port: 80,
        path: '/status.php?response=json'
    };
    http.get(options, function(res) {
        res.setEncoding('utf8');
        res.on('data', function(data){
            lastStatusData = JSON.parse(data);
            wasOpen = isOpen();
        });
    }).on('error', function(e) {
        console.log("Got http status error error: " + e.message);
    });
    setTimeout(updateSpaceStatus, statusTime);
};
updateSpaceStatus();

var isOpen = function(){
    return lastStatusData['all']>0;
};

var commands = {
    pong :  function(sender, to){
                var message =  'pong'
                var sendto  =  sendToWho(sender, to);
                if(isChannel(sender, to)){
                    message = sender + " " + message;
                }

                ircclient.say(sendto, message);
            },
    playing : function(sender, to){
                var sendto  =  sendToWho(sender, to);
                try{
                    mpd.send('currentsong',function(info) {
                        
                        if(!info['_OK']){
                            console.log('mpdc not ok: ' + util.inspect(info));
                            ircclient.say(sendto, "mpd error :(");
                            return;
                        }
                        
                        var message = "NP: " + info['Artist'] + ' - ' + info['Title'] + '(' + info['file'] + ')';
                        ircclient.say(sendto, message);
                    });
                }catch(e){ //connection lost
                    ircclient.say(sendto, "no connection to mpd");
                    console.log('caught exception :( :');
                    console.log(util.inspect(e));

                }
            },
    status : function(sender, to){
                var sendto = sendToWho(sender, to);
                var message;
                if(isOpen()){
                    message = ircColors.green("open (" + lastStatusData['all'] + ")");
                }else{
                    message = ircColors.red("closed");
                }
                ircclient.say(sendto, message);
                
            },
    add : function(sender, to, media){
                var sendto = sendToWho(sender, to);
                try{
                    mpd.send( ('add ' + media), function(info) {
                        console.log("added to playlist");
                        console.log(util.inspect(info));
                    });
                }catch(e){
                    ircclient.say(sendto, "error adding item to playlist :(");
                    console.log("Got mpd exception: " + e.message);
                }
            },
    play : function(sender, to, media){
                var sendto = sendToWho(sender, to);
                try{
                    mpd.send( ('addid ' + media), function(info) {
                        console.log("added to playlist");
                        console.log(util.inspect(info));
                        mpd.send( ('playid ' + info.Id), function(info) {
                            console.log("playing");
                            console.log(util.inspect(info));
                        });
                    });
                }catch(e){
                    ircclient.say(sendto, "error adding item to playlist :(");
                    console.log("Got mpd exception: " + e.message);
                }
            },

    help : function(sender, to){
                var sendto  = sendToWho(sender, to);
                var message = "see https://github.com/b4ckspace/ircbot";
                ircclient.say(sendto, message);
            },
};

var plenkers={};

var Filters = {
    plenking :  function(message, sender, to){
                    var expr = /\s{2,}/g ;
                    var hits = message.match(expr);
                    if( hits && (hits.length>=2) ){
                        if(plenkers[sender]){
                            ircclient.send("kick", to, sender, "plenking");
                        }else{
                            var message = sender + " bitte hier kein plenking.";
                            ircclient.say(to, message);
                            plenkers[sender] = true;
                            setTimeout(function(){
                                plenkers[sender] = undefined;
                                console.log("plenking cleared: "+sender);
                            },plenkingWait);
                        }
                        //console.log("plenking detected. channel:" + to + " user: " + sender);
                        
                    }
                },
};

var autoActions = {
    statusChange : function(){
        var newStatus = isOpen();
        if( (newStatus != wasOpen)&&(wasOpen!=undefined)) {
            var message = "new status: ";
            if(newStatus){
                message += ircColors.green("open (" + lastStatusData['all'] + ")");
            }else{
                message += ircColors.red("closed");
            }
            for(var k in channels){
                ircclient.say(channels[k], message);
            }
        }
        wasOpen = newStatus;
    },
    roomstatus : function(){
        var status;
        if(isOpen()){
            status = "open(" + lastStatusData['all'] + ")";
        }else{
            status = "closed";
        }
        var topicExpr=/open\(\d*\)|closed/g;
        for(var k in channels){
            var channel = channels[k];
            if(!topics[channel])
                continue;
            var newTopic = topics[channel].replace(topicExpr, status);
            if(newTopic != topics[channel]){
                ircclient.send("topic", channel, newTopic);
            }
        }
    },
};

var runAutoActions = function(){
    for(var k in autoActions){
        autoActions[k]();
    }
    setTimeout(runAutoActions, 2000);
};
runAutoActions();


