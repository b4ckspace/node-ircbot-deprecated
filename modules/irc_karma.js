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

var transfercnt = 1;
var transfers = {};
(COMMANDS["!transfer"] = function(sender, to, target){
    var that = this;
    getKarma(sender function(karma){
        if(karma==0)
            return
        var id = transfercnt;
        transfercnt++;
        var initdata = {
            blacklist:[sender, target],
            counter :0,
            replyto: [sender, to]
        };
        transfers[i] = initdata;
        that.reply(sender, to, "accept the request with !accept "+id+" via query")
    });
    //init transfer
}).helptext = "transfer your karma to another account";

(COMMANDS["!accept"] = function(sender, to, id){
    var that = this;
    if(!transfers[id]){
        LOGGER.warn('invalid transfer id "%s", send by %s', id, sender);
        that.reply(sender, to, 'invalid transfer id')
        return
    }
    if(sender in transfers[id].blacklist){
        LOGGER.warn("user %s is already in transfer blacklist for request %s", sender, id);
        that.reply(sender, to, 'you have already accepted the transaction or are part of it.')
        return
    }
    getKarma(sender function(karma){
        var karma_required = that.config.karma_min_accept;
        if(karma<karma_required){
            LOGGER.warn('user %s has not enougth karma (%s<%s)to accept transfer request %s', sender, karma, karma_required, id);
            that.reply(sender, to, 'you need at least' + karma_required + " karma");
            return
        }
        transfers[id].counter++;
        LOGGER.info("user %s accepted transfer request %s. request:");
        var accept_quota = that.config.karma_accept_quota;
        if(transfers[id].counter>=accept_quota){
            var info = transfers[id];
            that.reply(info.replyto[0], info.replyto[1], "karma transfer complete. maybe.")
            LOGGER.error("karma transfer complete but not implemented :(")
            transfers[id] = undefined;
            //do the magic!
        }
    });
}).helptext = "accept a karma transfer request";

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
    for(key in FILTERS){
        bot.filters[key] = FILTERS[key];
    }
    return {commands:COMMANDS};
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