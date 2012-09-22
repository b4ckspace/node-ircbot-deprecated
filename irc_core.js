var util        = require('util');
var exec        = require('child_process').exec; 

var commands = {};
var logger;
var running_version = "unknown";

var score_cooldown = 2 * 1000;


(commands['!update'] = function(sender, to){
    var cmd = 'git pull origin master';
    logger.info("update requested by %s in %s", sender, this.isChannel(sender,to)?to:'query' );
    exec(cmd, function (e, stdout, stderr) {
        logger.info('exec cmd: ' + cmd + " stdout: " + JSON.stringify(stdout));
        if (e !== null) {
            logger.error('exec cmd: ' + cmd + ' error: ' + error + "stderr: " + JSON.stringify(stderr));
        }
    });
}).helptext = "update bot to latest git version.";

(commands['!version'] = function(sender, to){
    this.reply(sender, to, running_version)
}).helptext = "print version number";

(commands['!commands'] = function(sender, to){
    var commandlist = "";
    for(cmd in this.commands){
        commandlist += cmd + ", ";
    }
    this.reply(sender, to, commandlist);
}).helptext = "get a list of all commands";

(commands['!more'] = function(sender, to, command){
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

/*
    '!ping' :   'pong',
    '!help' :   'see https://github.com/b4ckspace/ircbot',
*/

var bl_scores = {};
var dropMessage = function(message, sender, to){
    var score = bl_scores[sender]||0;
    var newscore = score+1;
    bl_scores[sender] = newscore;
    logger.debug("incr score "+sender+ " "+ bl_scores[sender]);
    setTimeout(function(){
        if(bl_scores[sender]==newscore){//no incement afert this one
            bl_scores[sender]=0;
            logger.debug("cooldown "+sender+ " "+ bl_scores[sender]);
        }else{
            logger.debug("no cooldown "+sender+ " "+ bl_scores[sender] + " != " + newscore);
        }

    }, newscore*score_cooldown);
    if(score>0)
        logger.warn("dropped user " + sender);
    return score>0;
};
var getBlCount = function(sender){
    return bl_scores[sender];
};

var filters = {
    flood : function(message, sender, to){
        if(dropMessage(message, sender, to)){
            if(getBlCount(sender)==5){
                this.reply(sender, to, "Wat R U Doin");
                this.reply(sender, to, "Stahp!");
            }
            return true
        }
    },
};

module.exports = function(cfg, log, bot){
    logger = log.getLogger("core");
    for(key in commands){
        bot.commands[key] = commands[key];
    }
    for(key in filters){
        bot.filters[key] = filters[key];
    }
    exec('git log -n 1 HEAD --format=oneline', function (e, stdout, stderr) {
        if (e !== null) {
            running_version = 'error getting git version';
            logger.error('exec error: ' + e + "stderr: " + JSON.stringify(stderr));
        }else{
            running_version=stdout;
            logger.info("version: ", running_version);
        }
    });
};