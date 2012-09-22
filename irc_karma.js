var nStore      = require('nstore');
var karma = nStore.new('data/karma.db', function () {});
var logger;
var config;
var karmaWait       = 60*1000;

var karma_timeouts={};
var commands = {};
(commands['!karma'] = function(sender, to, user){
    var that = this;
    var who  = user?user:sender;
    getKarma(who, function(karma){
        if(user){
            that.reply(sender, to, who + " hat " + karma + " karma");
        }else{
            that.reply(sender, to, "du hast " + karma + " karma");
        }
    });
}).helptext = "get own karma or of the given user";

var filters = {
    karma : function(message, sender, to){
        var karma_regex = /^([\w_\-\\\[\]\{\}\^`\|]+)[\s,:]*\+[\+1]/;
        var karmas = message.match(karma_regex);
        if(!karmas){
            return;
        }
        var nick = karmas[1];
        if(nick==sender){
            this.reply(sender, to, 'eigenlob stinkt :P');
            logger.info('self-karma %s', nick);
            return;
        }
        if(karma_timeouts[sender]){
            logger.info('karma while timeout');
            this.reply(sender, to, 'du kannst nur einmal pro minute karma verteilen.');
            return;
        }
        if(!this.isChannel(sender, to)){
            this.reply(sender, to, 'you can only give karma in channels.')
            logger.debug('no channel msg: %s sender: %s to: %s', message, sender, to);
            return;
        }
        this.irc_client.once('names', function(channel, names){
            if(channel != to){
                logger.warn('channel(%s) != to(%s)', channel, to);
                return;
            }
            if(names[nick]!=undefined){
                addKarma(nick);
                logger.info('%s gave %s karma (%s)', sender, nick, channel);
                karma_timeouts[sender]=true;
                setTimeout(function(){
                    karma_timeouts[sender]=undefined;
                    logger.info('karma timeout for user %s cleared', sender);
                },karmaWait);
            }else{
                logger.warn('%s tried to give karma to %s (%s). but user is not in channel', sender, nick, channel);
            }
        });
        this.irc_client.send('names', to);
    },
};

var addKarma = function(user){
    getKarma(user, function(count){
        karma.save(user, {karma: count+1}, function (err) {
            if (err) {
                logger.error("karma save error: " + util.inspect(err));
                return;
            }
            logger.info("saved %s karma for %s", count+1, user);
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

module.exports = function(cfg, log, bot){
    logger = log.getLogger("karma");
    config = cfg;
    for(key in commands){
        bot.commands[key] = commands[key];
    }
    for(key in filters){
        bot.filters[key] = filters[key];
    }
};