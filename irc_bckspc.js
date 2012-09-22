var bckspcApi   = require('./bckspcapi.js');
var webrelaisApi= require('./webrelais.js');
var webrelais = new webrelaisApi.Client("https://webrelais.bckspc.de:443");
var logger;
var config;
var spaceApi = new bckspcApi();
var alarmWait       = 60*1000;

var topics      = {};


var setTopic = function(channel, connection){
    if(!spaceApi.isReady()){
        setTimeout(function(){setTopic(channel, connection)}, 500);
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


var commands = {};
(commands['!status'] = function(sender, to){
    var message;
    if(spaceApi.isOpen()){
        message = "open (" + spaceApi.openCount() + ")";
    }else{
        message = "closed";
    }
    this.reply(sender, to, message);
    
}).helptext = "get the space status";


var alarm_blocked = false;
(commands['!alarm'] = function(sender, to) {
    if(!this.isChannel(sender, to)){
        this.reply(sender, to, "you can use !alarm only in channels.");
        logger.info("alarm not in channel %s", sender);
        return;
    }
    if(alarm_blocked){
        this.reply(sender, to, "https://www.youtube.com/watch?v=TqDsMEOYA9g");
        logger.info("alarm not ready %s %s", sender, to);
        return;
    }
    alarm_blocked=true;
    setTimeout(function(){
        alarm_blocked = false;
        logger.debug("alarm cooldown");
    }, alarmWait);
    var white = 3;
    var red   = 4;
    var on    = 1;
    var off   = 0;
    var waittime = 500;
    this.reply(sender, to, "alarm has been activated. backspace is now in defcon 2.");
    logger.info("alarm in channel %s by user %s", to, sender);
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


/*
    '!pampus':  'Dem Pampus fehlt Salz!',
    '!nerf':    'phew! phew! nerfgunfight!',
*/


module.exports = function(cfg, log, bot){
    logger = log.getLogger("bckspc");
    config = cfg;
    for(key in commands){
        bot.commands[key] = commands[key];
    }
    bot.irc_client.addListener('topic', function (channel, topic, nick, message){
        topics[channel] = topic;
        setTopic(channel, bot.irc_client);
        logger.debug("set channel, topic: " + channel + " , " + topic);
    });
    spaceApi.on('isopen', function(open){
    for(var k in channels){
        setTopic(k, bot.irc_client);
    }
});
};