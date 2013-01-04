var FILTERS = {};
var COMMANDS = {};
var BLACKLISTS = {};
var LOGGER;
var CONFIG;

var MODULE_NAME = "CORE";

var util        = require('util');
var exec        = require('child_process').exec; 
var running_version = "unknown";
var score_cooldown = 2 * 1000;

(COMMANDS['!version'] = function(sender, to){
    this.reply(sender, to, running_version)
}).helptext = "print version number";

(COMMANDS['!update'] = function(sender, to){
    var cmd = 'git pull origin master';
    LOGGER.info("update requested by %s in %s", sender, this.isChannel(sender,to)?to:'query' );
    exec(cmd, function (error, stdout, stderr) {
        LOGGER.info('exec cmd: ' + cmd + " stdout: " + JSON.stringify(stdout));
        if (e !== null) {
            LOGGER.error('exec cmd: ' + cmd + ' error: ' + error + "stderr: " + JSON.stringify(stderr));
        }
    });
}).helptext = "update bot to latest git version.";

(COMMANDS['!commands'] = function(sender, to){
    this.reply(sender, to, Object.keys(this.commands).join(', '));
}).helptext = "get a list of all commands";

(COMMANDS['!more'] = function(sender, to, command){
    if(!command){
        this.reply(sender, to, "for general help, use !help or !commands");
        return;
    }
    if(!this.commands[command]){
        this.reply(sender, to, "command not found");
        return;
    }
    var text;
    if(text = this.commands[command].helptext){
        this.reply(sender, to, command + ": " + text);
    }else{
        this.reply(sender, to, "no helptext found");
        return;
    }
}).helptext = "get more help for a command";

(COMMANDS['!ping'] = function(sender, to, command){
    this.reply(sender, to, 'pong');
}).helptext = "pong";

(COMMANDS['!help'] = function(sender, to, command){
    this.reply(sender, to, '!commands, !more <command> or visit https://github.com/b4ckspace/ircbot');
}).helptext = "pong";

BLACKLISTS.flood = function(message, sender, to){
    if(dropMessage(message, sender, to)){
        if(getBlCount(sender)==5){
            this.reply(sender, to, "Wat R U Doin");
            this.reply(sender, to, "Stahp!");
        }
        return true
    }
};


module.exports = function(cfg, log, bot){
    LOGGER = log.getLogger(MODULE_NAME);
    CONFIG = cfg;
    for(key in COMMANDS){
        bot.commands[key] = COMMANDS[key];
    }
    for(key in FILTERS){
        bot.filters[key] = FILTERS[key];
    }
    for(key in BLACKLISTS){
        bot.blacklists[key] = BLACKLISTS[key];
    }
    bot.topics={};
    bot.irc_client.addListener('topic', function (channel, topic, nick, message){
        bot.topics[channel] = topic;
        LOGGER.debug("set channel, topic: " + channel + " , " + topic);
    });
    exec('git log -n 1 HEAD --format=oneline', function (e, stdout, stderr) {
        if (e !== null) {
            running_version = 'error getting git version';
            LOGGER.error('exec error: ' + e + "stderr: " + JSON.stringify(stderr));
        }else{
            running_version=stdout;
            LOGGER.info("version: ", running_version);
        }
    });
};


// helpers:
var bl_scores = {};
var dropMessage = function(message, sender, to){
    var score = bl_scores[sender]||0;
    var newscore = score+1;
    bl_scores[sender] = newscore;
    LOGGER.debug("incr score "+sender+ " "+ bl_scores[sender]);
    setTimeout(function(){
        if(bl_scores[sender]==newscore){//no incement afert this one
            bl_scores[sender]=0;
            LOGGER.debug("cooldown "+sender+ " "+ bl_scores[sender]);
        }else{
            LOGGER.debug("no cooldown "+sender+ " "+ bl_scores[sender] + " != " + newscore);
        }

    }, newscore*score_cooldown);
    if(score>0)
        LOGGER.warn("dropped user " + sender);
    return score>0;
};
var getBlCount = function(sender){
    return bl_scores[sender];
};
