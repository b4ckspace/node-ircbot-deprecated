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
var music_baseurl = "ftp://nfs/music/";

/*MPD SETTINGS*/
var mpd_host    = '10.1.20.5';
var mpd_port    = '6600';

var plenkingWait = 30*60*1000;//30min


var irc         = require('irc');
var util        = require('util');
var mpdSocket   = require('mpdsocket');
var nStore      = require('nstore');
var log4js      = require('log4js');
var bckspcApi   = require('./bckspcapi.js');
var exec        = require('child_process').exec;
var mpd;
var topics      = {};
var running_version = "unknown";


/*DB SETUP*/
var karma = nStore.new('data/karma.db', function () {});

/*LOG SETUP*/
log4js.configure({
    appenders: [
        { type: 'console' },
        { type: 'file', filename: 'logs/logs.log'}
    ]
});

var l_mpd   = log4js.getLogger("mpd");
var l_irc   = log4js.getLogger("irc");
var l_karma = log4js.getLogger("karma");
var l_blacklist = log4js.getLogger("blacklist");
var l_plenking = log4js.getLogger("plenking");
var l_other = log4js.getLogger("other");


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
    if(isChannel(from, to) && (from!=nick) ){
        contentFilter(message, from, to)
    }

    if(from!=nick){
        messageDispatcher(message, from, to);
    }
});
ircclient.addListener('error', function(message){
    l_irc.error(message);
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
    l_mpd.info("reconnect");
    mpd = new mpdSocket(mpd_host, mpd_port);
    mpd.on('close', function(){
        l_mpd.warn("close");
        mpdInit();
    });
    mpd.on('error', function(text){
        l_mpd.error(text);
        setTimeout(mpdInit, 5000);
    });
};

if(disable_mpd)
    mpdInit();

/*code*/
exec('git describe  --always --dirty', function (e, stdout, stderr) {
    if (e !== null) {
        l_other.error('exec error: ' + error + "stderr: " + stderr);
    }else{
        running_version=stdout;
    }
});

var messageDispatcher = function(message, sender, to){
    var args    = message.split(' ');
    var command = args[0];
    var fun;
    if(fun = commands[command]){
        if(dropMessage(message, sender, to))
            return;
        fun.apply(undefined, [sender, to].concat(args.slice(1)) );
    }
};

var contentFilter = function(message, sender, channel){
    for(var name in Filters){
        Filters[name](message, sender, channel);
    }
};

var bl_scores = {};
var score_cooldown = 2000;
var dropMessage = function(message, sender, channel){
    var score = bl_scores[sender]||0;
    var newscore = score+1;
    bl_scores[sender] = newscore;
    l_blacklist.debug("incr score "+sender+ " "+ bl_scores[sender]);
    setTimeout(function(){
        if(bl_scores[sender]==newscore){//no incement afert this one
            bl_scores[sender]=0;
            l_blacklist.debug("cooldown "+sender+ " "+ bl_scores[sender]);
        }else{
            l_blacklist.debug("no cooldown "+sender+ " "+ bl_scores[sender] + " != " + newscore);
        }

    }, newscore*score_cooldown);
    if(score>0)
        l_blacklist.warn("dropped user " + sender);
    return score>0;
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
        message = "closed";
    }else{
        message = "open";
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
                            l_mpd.error('np mpc not ok: ' + util.inspect(info));
                            ircclient.say(sendto, ircColors.red("mpd error :("));
                            return;
                        }
                        var premium  = /http.*\?[0-9a-f]*/g;
                        var filename = info['file'] ? info['file'].replace(premium, "premiumstream") : "";
                        var artist   = info['Artist'] ? info['Artist'] + " - " : "";
                        var message  =   "now playing: " + artist + info['Title'];
                        if((artist=="") || (info['Title']=="")){
                            message = message + '(' + filename + ')';
                        }
                        if( !info['Artist'] && !info['Title']){
                            message  = "now playing: " + filename;
                        }
                        ircclient.say(sendto, message);
                    });
                }catch(e){ //connection lost
                    ircclient.say(sendto, ircColors.red("mpd error :("));
                    l_mpd.error('np exception' + util.inspect(e));
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
                        if(info._OK){
                            ircclient.say(sendto, "added " + media + " to playlist");
                            l_mpd.info("addstream user:" + sender + " stream: " + media + " mpd: " + util.inspect(info));
                        }else{
                            l_mpd.error("addstream user:" + sender + " stream: " + media + " mpd: " + util.inspect(info));
                            ircclient.say(sendto, ircColors.red("error adding item to playlist :("));
                        }
                    });
                }catch(e){
                    ircclient.say(sendto, ircColors.red("error adding item to playlist :("));
                    l_mpd.error("addstream exception: " + util.inspect(e));
                }
            },
    '!playstream' : function(sender, to, media){
                var sendto = sendToWho(sender, to);
                try{
                    mpd.send( ('addid ' + media), function(info) {
                        if(info._OK){
                            mpd.send( ('playid ' + info.Id), function(info) {
                                if(info._OK){
                                    l_mpd.info("playstream user:" + sender + " stream: " + media + " mpd: " + util.inspect(info));
                                    ircclient.say(sendto, "playing " + media);
                                }else{
                                    l_mpd.error("playstream s2 user:" + sender + " stream: " + media + " mpd: " + util.inspect(info));
                                    ircclient.say(sendto, ircColors.red("error playing item to playlist :("));
                                }
                            });
                        }else{
                            l_mpd.error("playstream s1 user:" + sender + " stream: " + media + " mpd: " + util.inspect(info));
                            ircclient.say(sendto, ircColors.red("error playing item to playlist :("));
                        }
                    });
                }catch(e){
                    ircclient.say(sendto, ircColors.red("error playing item :("));
                    l_mpd.error("playstream exception user:" + sender + " stream: " + media + " mpd: " + util.inspect(e));
                }
            },
    '!add' : function(sender, to){
                var args = Array.prototype.slice.call(arguments);
                var term = args.slice(2).join(' ');
                l_mpd.info("search term: " + term);
                var sendto  =  sendToWho(sender, to);
                try{
                    mpd.send('search any "' + term + '"', function(response){
                        if(response['file']){ //if file is set, the response is no list
                            mpd.send( ('add "' + response['file'] + '"'), function(info) {
                                l_mpd.info("add to playlist " + util.inspect(info));
                                ircclient.say(sendto, 'added "'+response['file']+'" to playlist.');
                            });
                        }else if (response["_ordered_list"]){
                            ircclient.say(sendto, "no unique file found, specify your search and try again.");
                        }else{
                            ircclient.say(sendto,  ircColors.red("nothing found :("));
                        }
                    });
                }catch(e){
                    ircclient.say(sendto, ircColors.red("error adding item :("));
                    l_mpd.error("add exception user:" + sender + " term: " + term + " mpd: " + util.inspect(e));
                }
            },
    '!npfile' : function(sender, to){
                try{
                    mpd.send('currentsong',function(response) {
                        var sendto  = sendToWho(sender, to);
                        var message = music_baseurl + encodeURIComponent(response['file']);
                        ircclient.say(sendto, message);
                    });
                }catch(e){
                    ircclient.say(sendto, ircColors.red("error getting file :("));
                    l_mpd.error("npfile exception user:" + sender + " term: " + term + " mpd: " + util.inspect(e));
                }
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
    '!nerf': function(sender, to){
                var sendto = sendToWho(sender, to);
                ircclient.say(sendto, 'phew! phew! nerfgunfight!');
            },
    '!version': function(sender, to){
                var sendto = sendToWho(sender, to);
                ircclient.say(sendto, running_version);
            },
};

var plenkers={};

var Filters = {
    plenking :  function(message, sender, to){
                    var expr = /\s{2,}/g ;
                    var hits = message.match(expr);
                    if( hits && (hits.length>=2) ){
                        l_plenking.info("plenking detected user: " + sender);
                        if(plenkers[sender]){
                            l_plenking.warn("kicking user: " + sender + " from channel " + to);
                            ircclient.send("kick", to, sender, "plenking");
                        }else{
                            var message = sender + " bitte hier kein plenking.";
                            ircclient.say(to, message);
                            plenkers[sender] = true;
                            setTimeout(function(){
                                plenkers[sender] = undefined;
                                ircclient.info("plenking cleared for user " + sender);
                            },plenkingWait);
                        }  
                    }
                },
};
