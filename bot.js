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
var nick        = config.nick;
var realname    = config.realname;
var username    = config.username;
var irc_server  = config.irc_server;
var irc_port    = config.irc_port;
var ircpass     = config.ircpass;
var secure      = config.secure;
var ignoreSsl   = config.ignoreSsl;
var channels    = config.channels;

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


var logger = log4js.getLogger("CORE");
logger.info("STARTUP");


var IrcBot = function(){
    var that = this;
    this.irc_client = new irc.Client( irc_server, nick, {
        'channels'      : channels,
        'userName'      : username,
        'realName'      : realname,
        'port'          : irc_port,
        'secure'        : secure,
        'selfSigned'    : ignoreSsl,
        'certExpired'   : ignoreSsl,
        'password'      : ircpass,
    });
    this.irc_client .addListener('message', function (from, to, message) {
        if((from!=nick) && (!that.contentFilter(message, from, to)) ){
            that.messageDispatcher(message, from, to);
        }
    });
    this.irc_client .addListener('error', function(message){
        logger.error(JSON.stringify(message));
    });
    this.commands   = {};
    this.filters    = {};
    this.blacklists = {};
    this.channelwarn = {};
    this.loadModules();
};

IrcBot.prototype.loadModules = function(){
    var that = this;
    config.modules.forEach(function(modname){
        logger.info("loading %s", modname);
        var hooks = require('./modules/irc_' + modname + '.js')(config, log4js, that);
        that.installHooks(hooks);
    });
};

IrcBot.prototype.installHooks = function(hooks){
    var that = this;
    Object.keys(hooks.commands).forEach(function(command){
        if(!that.commands[command])
            that.commands[command]=[];
        that.commands[command].push(hooks.commands[command])
    })
};

IrcBot.prototype.sendToWho = function(sender, to){
    return this.isChannel(sender, to) ? to : sender;
};

IrcBot.prototype.isChannel = function(sender, to){
    return to && to[0]=='#';
};

IrcBot.prototype.reply = function(sender, to, message, nowarn){
    var channelwarnTimeout = 5*60*1000;
    var warnstart = 5;
    if(this.isChannel(sender, to)){
        message = sender + ": " + message;
        if(!nowarn){
            var old = this.channelwarn[to];
            this.channelwarn[to] = old?old+1:1;//fix if value is undefined
            logger.debug("channelwarn incr %s:%s", to, this.channelwarn[to]);
            var that = this;
            setTimeout(function(){
                that.channelwarn[to]--;
                logger.debug("channelwarn cooldown: %s -> %s", to, that.channelwarn[to]);
            }, channelwarnTimeout);
            if(this.channelwarn[to]>=warnstart){
                logger.info("channelwarn > 5 %s", to);
                message = message + " tip: you can send most commands via query.";
            }
        }
    }
    this.irc_client.say(this.sendToWho(sender, to), message);
};

IrcBot.prototype.messageDispatcher = function(message, sender, to){
    var args    = message.split(' ');
    var command = args[0];
    var funs;
    if(funs = this.commands[command]){
        if(this.isBlacklisted(message, sender, to))
            return;
        var that = this;
        funs.forEach(function(fun){
            fun.apply(that, [sender, to].concat(args.slice(1)) );
        })
    }
};

IrcBot.prototype.contentFilter = function(message, sender, to){
    for(var name in this.filters){
        if( this.filters[name].apply(bot, [message, sender, to]))
            return true;
    }
};

IrcBot.prototype.isBlacklisted = function(message, sender, to){
    for(var name in this.blacklists){
        if( this.blacklists[name].apply(bot, [message, sender, to]))
            return true;
    }
};

var bot = new IrcBot();
