/* IRC SETTNGS */
var nick        = 'bckspctest';
var realname    = 'backspace';
var username    = 'backspace';
var irc_server  = 'irc.freenode.net';
var irc_port    = 6667;
var secure      = false;
var ignoreSSl   = false;
var channels    = ['#bckspctest'];

/*MPD SETTINGS*/
var mpd_host    = '10.1.20.5';
var mpd_port    = '6600';




var irc         = require('irc');
var util        = require('util');
var http        = require('http');
var mpdSocket   = require('mpdsocket');
var mpd;
var ircclient   = new irc.Client( irc_server, nick, {
    'channels'      : channels,
    'userName'      : username,
    'realName'      : realname,
    'port'          : irc_port,
    'secure'        : secure,
    'selfSigned'    : ignoreSSl,
    'certExpired'   : ignoreSSl,
});

/*IRC SETUP*/
ircclient.addListener('message', function (from, to, message) {
    console.log(from + ' => ' + to + ': ' + message);
    if(from!=nick){
        messageDispatcher(message, from, to);
    }
});
ircclient.addListener('error', function(message){
    console.log('ERROR: '+ util.inspect(message));
});


/* MPD SETUP*/
var mpdInit = function(){
    mpd = new mpdSocket(mpd_host, mpd_port);
    mpd.on('close', function(){
        console.log("mpd socket closed. reconnecting");
        mpdInit();
    });
};
mpdInit();

/*code*/
var messageDispatcher=function(message, sender, to){
    var args=message.split(' ');
    var command=args[0];
    
    switch(command){
        case '!ping':
            commands.pong(sender,to);
        break;
        case '!np':
            commands.playing(sender,to);
        break;
        case '!status':
            commands.status(sender,to);
        break;
        case '!help':
            commands.help(sender,to);
        break;
        case '!add':
            commands.add(sender,to, args[1]);
        break;
        case '!play':
            commands.play(sender,to, args[1]);
        break;
        default:
            console.log('unknown command: ' + command);
        break;
    };
};

var sendToWho=function(sender, to){
    if(to[0]=='#'){ //via channel
        return to;
    }else{          //via query or notice
        return sender;
    }
};


var commands={
    pong :  function(sender, to){
                var message =  'pong'
                var sendto  =  sendToWho(sender, to);
                if(sendto != sender){
                    message = sender + " " + message;
                }

                ircclient.say(sendto, message);
            },
    playing : function(sender, to){
                var sendto  =  sendToWho(sender, to);
                try{
                    mpd.send('currentsong',function(info) {
                        
                        if(!info['_OK']){
                            console.log('mpdc not ok: '+util.inspect(info));
                            ircclient.say(sendto, "mpd error :(");
                            return;
                        }
                        
                        var message="NP: " + info['Artist'] + ' - ' + info['Title'];
                            ircclient.say(sendto, message);
                    });
                }catch(e){ //connection lost
                    ircclient.say(sendto, "no connection to mpd");
                    console.log('caught exception :( :');
                    console.log(util.inspect(e));

                }
            },
    status : function(sender, to){
                var sendto=sendToWho(sender, to);
                //http://status.bckspc.de/status.php?response=json
                var options = {
                    host: 'status.bckspc.de',
                    port: 80,
                    path: '/status.php?response=json'
                };
                http.get(options, function(res) {
                    console.log("Got response: " + res.statusCode);
                    res.setEncoding('utf8');
                    res.on('data', function(data){
                        var status=JSON.parse(data);
                        console.log("parsed status:");
                        console.log(status);
                        var message;
                        if(status['all']==0){
                            message="closed";
                        }else{
                            message="Open (" + status['all'] + ")";
                        }
                        ircclient.say(sendto, message);
                    });
                }).on('error', function(e) {
                    ircclient.say(sendto, "error fetching status :(");
                    console.log("Got http status error error: " + e.message);
                });
                
            },
    add : function(sender, to, media){
                var sendto=sendToWho(sender, to);
                try{
                    mpd.send( ('add '+media), function(info) {
                        console.log("added to playlist");
                        console.log(util.inspect(info));
                    });
                }catch(e){
                    ircclient.say(sendto, "error adding item to playlist :(");
                    console.log("Got mpd exception: " + e.message);
                }
            },
    play : function(sender, to, media){
                var sendto=sendToWho(sender, to);
                try{
                    mpd.send( ('addid '+media), function(info) {
                        console.log("added to playlist");
                        console.log(util.inspect(info));
                        mpd.send( ('playid '+info.Id), function(info) {
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
                var message = "!ping, !np, !stream, !status, !help, !add <streamurl>,  !play <streamurl> via query or channel";
                ircclient.say(sendto, message);
            },
};