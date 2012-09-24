var FILTERS = {};
var COMMANDS = {};
var LOGGER;
var CONFIG;

var MODULE_NAME = "BACKSPACE";

var bckspcApi   = require('../bckspcapi.js');
var webrelaisApi= require('../webrelais.js');
var webrelais   = new webrelaisApi.Client("https://webrelais.bckspc.de:443");
var spaceApi    = new bckspcApi();
var alarmWait   = 60*1000;




(COMMANDS['!status'] = function(sender, to){
    var message;
    if(spaceApi.isOpen()){
        message = "open (" + spaceApi.openCount() + ")";
    }else{
        message = "closed";
    }
    this.reply(sender, to, message);
    
}).helptext = "get the space status";


var alarm_blocked = false;
(COMMANDS['!alarm'] = function(sender, to) {
    if(!this.isChannel(sender, to)){
        this.reply(sender, to, "you can use !alarm only in channels.");
        LOGGER.info("alarm not in channel %s", sender);
        return;
    }
    if(alarm_blocked){
        this.reply(sender, to, "https://www.youtube.com/watch?v=TqDsMEOYA9g");
        LOGGER.info("alarm not ready %s %s", sender, to);
        return;
    }
    alarm_blocked=true;
    setTimeout(function(){
        alarm_blocked = false;
        LOGGER.debug("alarm cooldown");
    }, alarmWait);
    var white = 3;
    var red   = 4;
    var on    = 1;
    var off   = 0;
    var waittime = 500;
    var old_white;
    var old_red;
    this.reply(sender, to, "alarm has been activated. backspace is now in defcon 2.");
    LOGGER.info("alarm in channel %s by user %s", to, sender);
    webrelais.get_port(white, function(error, reply){
        old_white = reply.response ? 1 : 0;
        webrelais.get_port(red, function(error, reply){
            old_red = reply.response ? 1 : 0;
            webrelais.set_port(white, on, function(){
                setTimeout(function(){
                    webrelais.set_port(white, off);
                    webrelais.set_port(red, on, function(){
                        setTimeout(function(){
                            webrelais.set_port(red, off);
                            webrelais.set_port(white, on, function(){
                                setTimeout(function(){
                                    webrelais.set_port(white, old_white);
                                    webrelais.set_port(red, old_red);
                                }, waittime);
                            });
                        }, waittime);
                    });
                }, waittime);
            });
        })
    });
}).helptext = "flash the emergency light :)";

(COMMANDS['!pampus'] = function(sender, to, command){
    this.reply(sender, to, 'Dem Pampus fehlt Salz!');
}).helptext = 'Dem Pampus fehlt Salz!';

(COMMANDS['!nerf'] = function(sender, to, command){
    this.reply(sender, to, 'phew! phew! nerfgunfight!');
}).helptext = 'phew! phew! nerfgunfight!';


module.exports = function(cfg, log, bot){
    LOGGER = log.getLogger(MODULE_NAME);
    CONFIG = cfg;
    for(key in COMMANDS){
        bot.commands[key] = COMMANDS[key];
    }
    for(key in FILTERS){
        bot.filters[key] = FILTERS[key];
    }
    bot.irc_client.addListener('topic', function (channel, topic, nick, message){
        topics[channel] = topic;
        setTopic(channel, bot.irc_client);
        LOGGER.debug("set channel, topic: " + channel + " , " + topic);
    });
    spaceApi.on('isopen', function(open){
        for(var channel in topics){
            setTopic(channel, bot.irc_client);
        }
    });
};


var topics  = {};
var setTopic = function(channel, connection){
    if(!spaceApi.isReady()){
        spaceApi.once('ready', function(){
            setTopic(channel, connection)
        });
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
        connection.send("topic", channel, newTopic);
    }
};