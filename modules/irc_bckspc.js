var FILTERS = {};
var COMMANDS = {};
var LOGGER;
var CONFIG;

var MODULE_NAME = "BACKSPACE";

var bckspcApi   = require('../bckspcapi.js');
var spaceApi    = new bckspcApi();

(COMMANDS['!status'] = function(sender, to){
    var message;
    if(spaceApi.isOpen()){
        message = "open (" + spaceApi.openCount() + ")";
    }else{
        message = "closed";
    }
    this.reply(sender, to, message);
    
}).helptext = "get the space status";

(COMMANDS['!inspace'] = function(sender, to, command){
    var reply = spaceApi.getMembers().join(', ') || 'nobody is in the space right now.';
    this.reply(sender, to, reply);
}).helptext = 'get the members that are currently in the space.';

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