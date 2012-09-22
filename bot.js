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

var score_cooldown  = 2000;


/*REQUIRES*/
var irc         = require('irc');
var util        = require('util');
var log4js      = require('log4js');

/*LOG SETUP*/
log4js.configure({
    appenders: [
        { type: 'console' },
        { type: 'file', filename: 'logs/logs.log'}
    ]
});

//var l_mpd   = log4js.getLogger("mpd");
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


/* SPACE API SETUP*/

var IrcBot = function(){
    this.commands={}; 
    this.filters={};
    this.irc_client = ircclient;
    require('./irc_core.js')(config, log4js, this);
    require('./irc_plenking.js')(config, log4js, this);
    require('./irc_karma.js')(config, log4js, this);
    require('./irc_bckspc.js')(config, log4js, this);
};

IrcBot.prototype.sendToWho = function(sender, to){
    return this.isChannel(sender, to) ? to : sender;
};

IrcBot.prototype.isChannel = function(sender, to){
    return to && to[0]=='#';
};

IrcBot.prototype.reply = function(sender, to, message){
    if(this.isChannel(sender, to))
        message = sender + " " + message;
    this.irc_client.say(sendToWho(sender, to), message);
};

var bot = new IrcBot();


if(!disable_mpd)
    require('./irc_mpd.js')(config, log4js, bot);

/*code*/


var messageDispatcher = function(message, sender, to){
    var args    = message.split(' ');
    var command = args[0];
    var fun;
    if(fun = commands[command]){
        if(dropMessage(message, sender, to)){
            if (getBlCount(sender) == 5){
                reply(sender, to, "Wat R U Doin");
                reply(sender, to, "Stahp!");
            }
            return;
        }
            
        fun.apply(bot, [sender, to].concat(args.slice(1)) );
    }
};

var contentFilter = function(message, sender, channel){
    for(var name in Filters){
        Filters[name].apply(bot, [message, sender, channel]);
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
var getBlCount = function(sender){
    return bl_scores[sender];
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



var commands = bot.commands;
var Filters = bot.filters;