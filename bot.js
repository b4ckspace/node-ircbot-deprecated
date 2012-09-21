/* IRC SETTNGS */
/* settings will be set/overwritten in the following order:
 * 1. config.js
 * 2. environment variables
 * 3. config.local.js
 */
var config;
try{
	config = require('./config.local.js');
}catch(e){
	config = require('./config.js');
}
var nick = config.nick;
var realname = config.realname;
var username = config.username;
var irc_server = config.irc_server;
var irc_port = config.irc_port;
var ircpass = config.ircpass;
var secure = config.secure;
var ignoreSsl = config.ignoreSsl;
var channels = config.channels;
var disable_mpd = config.disable_mpd;



var music_baseurl   = "ftp://nfs/music/";
var plenkingWait    = 30*60*1000;//30min
var karmaWait       = 60*1000;
var alarmWait       = 60*1000;
var score_cooldown  = 2000;

/*MPD SETTINGS*/
var mpd_host    = '10.1.20.5';
var mpd_port    = '6600';



/*REQUIRES*/
var irc         = require('irc');
var util        = require('util');
var mpdSocket   = require('mpdsocket');
var nStore      = require('nstore');
var log4js      = require('log4js');
var bckspcApi   = require('./bckspcapi.js');
var webrelaisApi= require('./webrelais.js');
var exec        = require('child_process').exec;
var mpd;
var topics      = {};
var running_version = "unknown";
var webrelais = new webrelaisApi.Client("https://webrelais.bckspc.de:443");

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
var l_webrelais = log4js.getLogger("webrelais");
var l_other = log4js.getLogger("other");
l_other.info("STARTUP");


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
    topics[channel] = topic;
    setTopic(channel);
    l_irc.debug("set channel, topic: " + channel + " , " + topic);
});

/* SPACE API SETUP*/
var spaceApi = new bckspcApi();
spaceApi.on('isopen', function(open){
    for(var k in channels){
        setTopic(k);
    }
});

/* MPD SETUP*/
var mpdInit = function(){
    l_mpd.debug("reconnect");
    mpd = new mpdSocket(mpd_host, mpd_port);
    mpd.on('close', function(){
        l_mpd.debug("close");
        mpdInit();
    });
    mpd.on('error', function(text){
        l_mpd.error(text);
        setTimeout(mpdInit, 5000);
    });
};

if(!disable_mpd)
    mpdInit();

/*code*/
exec('git log -n 1 HEAD --format=oneline', function (e, stdout, stderr) {
    if (e !== null) {
        running_version = 'error getting git version';
        l_other.error('exec error: ' + e + "stderr: " + JSON.stringify(stderr));
    }else{
        running_version=stdout;
        l_other.info("version: ", running_version);
    }
});

var messageDispatcher = function(message, sender, to){
    var args    = message.split(' ');
    var command = args[0];
    var fun;
    if(response = strings[command]){
        reply(sender, to, response);
    }else if(fun = commands[command]){
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

var reply = function(sender, to, message){
    if(isChannel(sender, to))
        message = sender + " " + message;
    ircclient.say(sendToWho(sender, to), message);
};

var ircColors = {
    red : function(text){
        return irc.colors.wrap('dark_red', text);
    },
    green : function(text){
        return irc.colors.wrap('light_green', text);
    },
};

var setTopic = function(channel){
    if(!spaceApi.isReady()){
        setTimeout(function(){setTopic(channel)}, 500);
        return;
    }
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

var strings = {
    '!ping' :   'pong',
    '!help' :   'see https://github.com/b4ckspace/ircbot',
    '!pampus':  'Dem Pampus fehlt Salz!',
    '!nerf':    'phew! phew! nerfgunfight!',
};

var commands = {};

(commands['!status'] = function(sender, to){
    var message;
    if(spaceApi.isOpen()){
        message = ircColors.green("open (" + spaceApi.openCount() + ")");
    }else{
        message = ircColors.red("closed");
    }
    reply(sender, to, message);
    
}).helptext = "get the space status";


if(!disable_mpd){
    (commands['!np'] = function(sender, to){
        try{
            mpd.send('currentsong',function(info) {
                if(!info['_OK']){
                    l_mpd.error('np mpc not ok: ' + util.inspect(info));
                    reply(sender, to, ircColors.red("mpd error :("));
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
                reply(sender, to, message);
            });
        }catch(e){
            reply(sender, to, ircColors.red("mpd error :("));
            l_mpd.error('np exception' + util.inspect(e));
        }
    }).helptext = "now playing.";

    (commands['!addstream'] = function(sender, to, media){
        try{
            mpd.send( ('add ' + media), function(info) {
                if(info._OK){
                    reply(sender, to, "added " + media + " to playlist");
                    l_mpd.info("addstream user:" + sender + " stream: " + media + " mpd: " + util.inspect(info));
                }else{
                    l_mpd.error("addstream user:" + sender + " stream: " + media + " mpd: " + util.inspect(info));
                    reply(sender, to, ircColors.red("error adding item to playlist :("));
                }
            });
        }catch(e){
            reply(sender, to, ircColors.red("error adding item to playlist :("));
            l_mpd.error("addstream exception: " + util.inspect(e));
        }
    }).helptext = "adds the stream to the mpd playlist.";

    (commands['!playstream'] = function(sender, to, media){
        try{
            mpd.send( ('addid ' + media), function(info) {
                if(info._OK){
                    mpd.send( ('playid ' + info.Id), function(info) {
                        if(info._OK){
                            l_mpd.info("playstream user:" + sender + " stream: " + media + " mpd: " + util.inspect(info));
                            reply(sender, to, "playing " + media);
                        }else{
                            l_mpd.error("playstream s2 user:" + sender + " stream: " + media + " mpd: " + util.inspect(info));
                            reply(sender, to, ircColors.red("error playing item:("));
                        }
                    });
                }else{
                    l_mpd.error("playstream s1 user:" + sender + " stream: " + media + " mpd: " + util.inspect(info));
                    reply(sender, to, ircColors.red("error playing item:("));
                }
            });
        }catch(e){
            reply(sender, to, ircColors.red("error playing item :("));
            l_mpd.error("playstream exception user:" + sender + " stream: " + media + " mpd: " + util.inspect(e));
        }
    }).helptext = "play the given stream.";

    (commands['!add'] = function(sender, to){
        var args = Array.prototype.slice.call(arguments);
        var term = args.slice(2).join(' ');
        l_mpd.info("search term: " + term);
        try{
            mpd.send('search any "' + term + '"', function(response){
                if(response['file']){ //if file is set, the response is no list
                    mpd.send( ('add "' + response['file'] + '"'), function(info) {
                        l_mpd.info("add to playlist " + util.inspect(info));
                        reply(sender, to, 'added "'+response['file']+'" to playlist.');
                    });
                }else if (response["_ordered_list"]){
                    reply(sender, to, ircColors.red("no unique file found, specify your search and try again."));
                }else{
                    reply(sender, to,  ircColors.red("nothing found :("));
                }
            });
        }catch(e){
            reply(sender, to, ircColors.red("error adding item :("));
            l_mpd.error("add exception user:" + sender + " term: " + term + " mpd: " + util.inspect(e));
        }
    }).helptext = "add the song matching the searchterm to the playlist.";

    (commands['!npfile'] = function(sender, to){
        try{
            mpd.send('currentsong',function(response) {
                var sendto  = sendToWho(sender, to);
                var message = music_baseurl + encodeURIComponent(response['file']);
                reply(sender, to, message);
            });
        }catch(e){
            reply(sender, to, ircColors.red("error getting file :("));
            l_mpd.error("npfile exception user:" + sender + " term: " + term + " mpd: " + util.inspect(e));
        }
    }).helptext = "get the path to the current playing file";
}

(commands['!update'] = function(sender, to){
    var cmd = 'git pull origin master';
    l_other.info("update requested by %s in %s", sender, isChannel(sender,to)?to:'query' );
    exec(cmd, function (e, stdout, stderr) {
        l_other.info('exec cmd: ' + cmd + " stdout: " + JSON.stringify(stdout));
        if (e !== null) {
            l_other.error('exec cmd: ' + cmd + ' error: ' + error + "stderr: " + JSON.stringify(stderr));
        }
    });
}).helptext = "update bot to latest git version.";

(commands['!karma'] = function(sender, to, user){
    var who = user?user:sender;
    getKarma(who, function(karma){
        if(user){
            reply(sender, to, who + " hat " + karma + " karma");
        }else{
            reply(sender, to, "du hast " + karma + " karma");
        }
    });
}).helptext = "get own karma or of the given user";

(commands['!version'] = function(sender, to){
    reply(sender, to, running_version)
}).helptext = "print version number";

var alarm_blocked = false;
(commands['!alarm'] = function(sender, to) {
    if(!isChannel(sender, to)){
        reply(sender, to, "you can use !alarm only in channels.");
        l_webrelais.info("alarm not in channel %s", sender);
        return;
    }
    if(alarm_blocked){
        reply(sender, to, "https://www.youtube.com/watch?v=TqDsMEOYA9g");
        l_webrelais.info("alarm not ready %s %s", sender, to);
        return;
    }
    alarm_blocked=true;
    setTimeout(function(){
        alarm_blocked = false;
        l_webrelais.debug("alarm cooldown");
    }, alarmWait);
    var white = 3;
    var red   = 4;
    var on    = 1;
    var off   = 0;
    var waittime = 500;
    reply(sender, to, "alarm has been activated. backspace is now in defcon 2".);
    l_webrelais.info("alarm in channel %s by user %s", sender, to);
    webrelais.set_port(white, on, function(){
        setTimeout(function(){
            webrelais.set_port(white, off, function(){});
            webrelais.set_port(red, on, function(){
                setTimeout(function(){
                    webrelais.set_port(red, off, function(){});
                    webrelais.set_port(white, on, function(){
                        setTimeout(function(){
                            webrelais.set_port(white, off, function(){});
                        }, waittime);
                    });
                }, waittime);
            });
        }, waittime);
    });
}).helptext = "flash the emergency light :)";

(commands['!commands'] = function(sender, to){
    var commandlist = "";
    for(str in strings){
        commandlist += str + ", ";
    }
    for(cmd in commands){
        commandlist += cmd + ", ";
    }
    reply(sender, to, commandlist);
}).helptext = "get a list of all commands";

(commands['!more'] = function(sender, to, command){
    if(!command){
        reply(sender, to, "for general help, use !help or !commands");
        return;
    }
    if(!commands[command]){
        reply(sender, to, "command not found");
        return;
    }
    var text;
    if(text = commands[command].helptext){
        reply(sender, to, command + ": " + text);
    }else{
        reply(sender, to, "no helptext found");
        return;
    }
}).helptext = "get more help for a command";

var plenkers={};
var karma_timeouts={};
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
                            reply(sender, to, "bitte hier kein plenking.");
                            plenkers[sender] = true;
                            setTimeout(function(){
                                plenkers[sender] = undefined;
                                l_plenking.info("plenking cleared for user " + sender);
                            },plenkingWait);
                        }  
                    }
                },
    karma : function(message, sender, to){
        var karma_regex = /^([\w_\-\\\[\]\{\}\^`\|]+)[\s,:]*\+[\+1]/;
        var karmas = message.match(karma_regex);
        //console.log(karmas);
        if(!karmas){
            //l_karma.debug('no karmas found msg: %s sender: %s to: %s', message, sender, to);
            return;
        }
        var nick = karmas[1];
        if(nick==sender){
            reply(sender, to, 'eigenlob stinkt :P');
            l_karma.info('self-karma %s', nick);
            return;
        }
        //console.log("karma");
        if(karma_timeouts[sender]){
            l_karma.info('karma while timeout');
            reply(sender, to, 'du kannst nur einmal pro minute karma verteilen.');
            return;
        }
        if(!isChannel(sender, to)){
            reply(sender, to, 'you can only give karma in channels.')
            l_karma.debug('no channel msg: %s sender: %s to: %s', message, sender, to);
            return;
        }
        //console.log(karmas);
        
        //console.log("names " + to);
        ircclient.once('names', function(channel, names){
            if(channel != to){
                l_karma.warn('channel(%s) != to(%s)', channel, to);
                return;
            }
            if(names[nick]!=undefined){
                addKarma(nick);
                l_karma.info('%s gave %s karma (%s)', sender, nick, channel);
                karma_timeouts[sender]=true;
                setTimeout(function(){
                    karma_timeouts[sender]=undefined;
                    l_karma.info('karma timeout for user %s cleared', sender);
                },karmaWait);
            }else{
                l_karma.warn('%s tried to give karma to %s (%s). but user is not in channel', sender, nick, channel);
            }
        });
        ircclient.send('names', to);
    },
};

var addKarma = function(user){
    getKarma(user, function(count){
        karma.save(user, {karma: count+1}, function (err) {
            if (err) {
                l_karma.error("karma save error: " + util.inspect(err));
                return;
            }
            l_karma.info("saved %s karma for %s", count+1, user);
        });
    });
};

var getKarma = function(user, callback){
    karma.get(user, function (err, doc, key) {
        if (err) {
            //console.log(err);
            callback(0);
            return;
        }
        //console.log(doc);
        callback(doc.karma);
    });
}; 