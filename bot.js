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
var disable_mpd = config.disable_mpd;


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


var l_other = log4js.getLogger("other");
l_other.info("STARTUP");


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
        l_other.error(JSON.stringify(message));
    });
    this.commands   = {}; 
    this.filters    = {};
    this.blacklists = {};
    //this.irc_client = ircclient;
    require('./irc_core.js')(config, log4js, this);
    require('./irc_plenking.js')(config, log4js, this);
    require('./irc_karma.js')(config, log4js, this);
    require('./irc_bckspc.js')(config, log4js, this);
    if(!disable_mpd)
        require('./irc_mpd.js')(config, log4js, this);
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
    this.irc_client.say(this.sendToWho(sender, to), message);
};

IrcBot.prototype.messageDispatcher = function(message, sender, to){
    var args    = message.split(' ');
    var command = args[0];
    var fun;
    if(fun = this.commands[command]){
        if(this.isBlacklisted(message, sender, to))
            return;
        fun.apply(this, [sender, to].concat(args.slice(1)) );
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
