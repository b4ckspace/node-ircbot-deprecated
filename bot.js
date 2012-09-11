var env=process.env;
/* IRC SETTNGS */
var nick        = env['nick']       || 'b4ckspace_bot';
var realname    = env['realname']   || 'b4ckspace_bot';
var username    = env['username']   || 'b4ckspace_bot';
var irc_server  = env['irc_server'] || 'irc.freenode.net';
var irc_port    = env['irc_port']   || 6667;
var ircpass     = env['irc_pass']   || undefined;
var secure      = env['irc_ssl']    == "true";
var ignoreSsl   = env['ssl_ignore'] == "true";
var channels    = (env['channels']  && env['channels'].split(','))||['#backspace'];
var disable_mpd = env['nompd']      != "true";

/*MPD SETTINGS*/
var mpd_host    = '10.1.20.5';
var mpd_port    = '6600';

var plenkingWait = 30*60*1000;//30min


var irc         = require('irc');
var util        = require('util');
var mpdSocket   = require('mpdsocket');
var bckspcApi   = require('./bckspcapi.js');
var exec = require('child_process').exec;
var mpd;
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
    var joined = !topics[channel];
    topics[channel] = topic;
    if(joined){
        setTopic(topics[channel], spaceApi.isOpen());
    }
});

/* SPACE API SETUP*/
var spaceApi    = new bckspcApi();
spaceApi.on('isopen', function(open){
    for(var k in channels){
        setTopic(channels[k], open);
    }
});

/* MPD SETUP*/
var mpdInit = function(){
    console.log("mpdInit");
    mpd = new mpdSocket(mpd_host, mpd_port);
    mpd.on('close', function(){
        mpdInit();
    });
    mpd.on('error', function(){
        setTimeout(mpdInit, 10000);
    });
};
if(disable_mpd)
    mpdInit();

/*code*/
var messageDispatcher = function(message, sender, to){
    var args    = message.split(' ');
    var command = args[0];
    var fun;
    if(fun = commands[command]){
        fun.apply(undefined, [sender, to].concat(args.slice(1)) );
    }
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
    return to && to[0]=='#';
};

var ircColors = {
    red : function(text){
        return irc.colors.wrap('dark_red', text);
    },
    green : function(text){
        return irc.colors.wrap('light_green', text);
    },
};


var setTopic = function(channel, isopen){
    if(spaceApi.isOpen()){
        message = "open";
    }else{
        message = "closed";
    }
    var topicExpr=/open|closed/g;
    if(!topics[channel])
        return;
    var newTopic = topics[channel].replace(topicExpr, message);
    if(newTopic != topics[channel]){
        ircclient.send("topic", channel, newTopic);
    }
};

var commands = {
    '!ping' :  function(sender, to){
                var message =  'pong';
                var sendto  =  sendToWho(sender, to);
                if(isChannel(sender, to)){
                    message = sender + " " + message;
                }

                ircclient.say(sendto, message);
            },
    '!np' : function(sender, to){
                var sendto  =  sendToWho(sender, to);
                try{
                    mpd.send('currentsong',function(info) {
                        
                        if(!info['_OK']){
                            console.log('mpdc not ok: ' + util.inspect(info));
                            ircclient.say(sendto, "mpd error :(");
                            return;
                        }
                        var premium  = /http.*\?[0-9a-f]*/g;
                        var filename = info['file'] ? info['file'].replace(premium, "premiumstream") : "";
                        var artist   = info['Artist'] ? info['Artist'] + " - " : "";
                        var message  =   "now playing: " + 
                                        artist + info['Title'] + 
                                        '(' + filename + ')';
                        if( !info['Artist'] && !info['Title']){
                            message  = "now playing: " + filename;
                        }
                        ircclient.say(sendto, message);
                    });
                }catch(e){ //connection lost
                    ircclient.say(sendto, "no connection to mpd");
                    console.log('caught exception :( :');
                    console.log(util.inspect(e));

                }
            },
    '!status' : function(sender, to){
                var sendto = sendToWho(sender, to);
                var message;
                if(spaceApi.isOpen()){
                    message = ircColors.green("open (" + spaceApi.openCount() + ")");
                }else{
                    message = ircColors.red("closed");
                }
                ircclient.say(sendto, message);
                
            },
    '!addstream' : function(sender, to, media){
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
    '!playstream' : function(sender, to, media){
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
    '!add' : function(sender, to){
                var args = Array.prototype.slice.call(arguments);
                var term = args.slice(2).join(' ');
                console.log(term);
                mpd.send('search any "' + term + '"', function(response){
                    if(response['file']){ //if file is set, the response is no list
                        mpd.send( ('add "' + response['file'] + '"'), function(info) {
                            console.log("added to playlist");
                            console.log(util.inspect(info));
                            var message =  'added "'+response['file']+'" to playlist.';
                            var sendto  =  sendToWho(sender, to);
                            if(isChannel(sender, to)){
                                message = sender + " " + message;
                            }

                            ircclient.say(sendto, message);
                        });
                    }
                    console.log(util.inspect(response));
                });
            },
    '!help' : function(sender, to){
                var sendto  = sendToWho(sender, to);
                var message = "see https://github.com/b4ckspace/ircbot";
                ircclient.say(sendto, message);
            },
    '!pampus': function(sender, to){
                var sendto = sendToWho(sender, to);
                ircclient.say(sendto, 'Dem Pampus fehlt Salz!');
            },
    '!version': function(sender, to){
                var sendto = sendToWho(sender, to);

                exec('git describe  --always --dirty', function (e, stdout, stderr) {
                    //console.log('stdout: ' + stdout);
                    //console.log('stderr: ' + stderr);
                    if (e !== null) {
                        console.log('exec error: ' + error + "stderr: " + stderr);
                    }else{
                        ircclient.say(sendto, stdout);
                    }
                });
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
                    }
                },
};
