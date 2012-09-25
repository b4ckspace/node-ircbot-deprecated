var FILTERS = {};
var COMMANDS = {};
var LOGGER;
var CONFIG;

var MODULE_NAME = "GITHUB";

var GitHubApi = require("github");

var github = new GitHubApi({
    version: "3.0.0"
});

var report_timeout = 5 * 60 * 1000;
var report_locked = false;
(COMMANDS['!bugreport']=function(sender, to){
    if(report_locked){
        this.reply(sender, to, "you have to wait 5 minutes between 2 bugreports.");
        return;
    }
    report_locked = true;
    setTimeout(function(){report_locked=false;}, report_timeout);
    var that  = this;
    var args  = Array.prototype.slice.call(arguments);
    var title = "irc: " + args.slice(2).join(' ');
    var text  = "irc bugreport by " + sender;
    var data  = { user   : CONFIG.github_repouser, 
                  repo   : CONFIG.github_repo, 
                  title  : title, 
                  body   : text, 
                  labels : ['irc']};
    LOGGER.info("create issue user: %s channel: %s, data: %s", sender, to, JSON.stringify(data));
    github.issues.create(data, function(error, response){
        if(error){
            LOGGER.error("error reating issue: %s", JSON.stringify(error));
            that.reply(sender, to, "error creating issue");
        }else{
            LOGGER.info("created issue, response: %s", JSON.stringify(response));
            that.reply(sender, to, "created issue: " + response.html_url);
        }
    });

}).helptext = "create a bugreport.";

module.exports = function(cfg, log, bot){
    LOGGER = log.getLogger(MODULE_NAME);
    CONFIG = cfg;
    for(key in COMMANDS){
        bot.commands[key] = COMMANDS[key];
    }
    for(key in FILTERS){
        bot.filters[key] = FILTERS[key];
    }

    github.authenticate({
    type: "oauth",
        username: CONFIG.github_user,
        token: CONFIG.github_token
    });
};