var FILTERS = {};
var COMMANDS = {};
var LOGGER;
var CONFIG;

var MODULE_NAME = "KARMA";

var util        = require("util");
var nStore      = require('nstore');
nStore          = nStore.extend(require('nstore/query')());
var karma       = nStore.new('data/karma.db', function () {});
var karmaWait   = 60*1000;
var karma_timeouts={};

(COMMANDS['!karma'] = function(sender, to, user){
    var that = this;
    if(sender == user){
        user = undefined;
    }
    var who  = user?user:sender;
    getKarma(who, function(karma){
        if(user){
            that.reply(sender, to, who + " hat " + karma + " karma");
        }else{
            that.reply(sender, to, "du hast " + karma + " karma");
        }
    });
}).helptext = "get own karma or of the given user";

(COMMANDS["!karmatop"] = function(sender, to){
    var that=this;
    getAll(function(error, data){
        if(error){
            that.reply(sender, to, "error getting karma.");
            return;
        }
        var karmanicks = [];
        for(nick in data){
            karmanicks.push({nick:nick, karma:data[nick].karma});
        }
        karmanicks = karmanicks .sort(function(a,b){return a.karma-b.karma})
                                .reverse()
                                .slice(0, 3)
                                .map(function(u){return u.nick + ": " + u.karma})
                                .join(', ');
        that.reply(sender, to, karmanicks)
        //console.log(karmanicks);
    });
}).helptext = "karma highscore";



FILTERS.karma = function(message, sender, to){
    var karma_regex = /^([\w_\-\\\[\]\{\}\^`\|]+)[\s,:]*\+[\+1]/;
    var karmas = message.match(karma_regex);
    if(!karmas){
        return;
    }
    var nick = karmas[1];
	if(!this.isChannel(sender, to)){
        this.reply(sender, to, 'you can only give karma in channels.')
        LOGGER.debug('no channel msg: %s sender: %s to: %s', message, sender, to);
        return;
    }
    if(nick == sender){
        this.reply(sender, to, 'eigenlob stinkt :P');
        LOGGER.info('self-karma %s', nick);
        return;
    }
    if(karma_timeouts[sender]){
        LOGGER.info('karma while timeout');
        this.reply(sender, to, 'du kannst nur einmal pro minute karma verteilen.', true);
        return;
    }
    this.irc_client.once('names'+to, function(names){
        if(names[nick] != undefined){
            addKarma(nick);
            LOGGER.info('%s gave %s karma (%s)', sender, nick, to);
            karma_timeouts[sender] = true;
            setTimeout(function(){
                karma_timeouts[sender] = undefined;
                LOGGER.info('timeout for user %s cleared', sender);
            },karmaWait);
        }else{
            LOGGER.warn('%s tried to give karma to %s (%s). but user is not in channel', sender, nick, to);
        }
    });
    this.irc_client.send('names', to);
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
};

var addKarma = function(user){
    getKarma(user, function(count){
        karma.save(user, {karma: count+1}, function (err) {
            if (err) {
                LOGGER.error("save error: " + util.inspect(err));
                return;
            }
            LOGGER.info("saved %s karma for %s", count+1, user);
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

var getAll = function(callback){
    karma.all(function(err, data){
        var error = false;
        if (err) {
            LOGGER.error("getAll error: " + JSON.stringify(util.inspect(err)));
            error = true;
        }
        callback(error, data);
    });
};