var FILTERS = {};
var COMMANDS = {};
var LOGGER;
var CONFIG;

var MODULE_NAME = "KARMA";

var util        = require("util");
var r           = require('rethinkdb');

var nStore      = require('nstore');
nStore          = nStore.extend(require('nstore/query')());
var karma       = nStore.new('data/karma.db', function () {});
var karma_alias = nStore.new('data/karma_alias.db', function () {});
var karmaWait   = 60*1000;
var karma_timeouts  = {};
var db_dbname       = "ircbot";
var db_karmatable   = "karma";

var connection;
var initDb = function(){
    r.connect({host: 'localhost', port: 28015}, function(err, conn) {
        if(err)
            throw err;
        LOGGER.debug('rethinkdb connection ok');
        connection = conn;
        validateDb();
    });
};

var validateDb = function(){
    r.dbList().run(connection, function(err, dbs){
        if(err)
            throw err
        if(dbs.indexOf(db_dbname)==-1){
            LOGGER.info('ircbot db does not exist, creating now');
            r.dbCreate(db_dbname).run(connection, function(err, result){
                if(err)
                    throw err;
                LOGGER.info('ircbot db created');
                validateTable()
            })
        }else{
            LOGGER.debug('found db, checking for table')
            validateTable();
        }
    })
};

var validateTable = function(){
    connection.use(db_dbname)
    r.tableList().run(connection, function(err, tables){
        if(err)
            throw err;
        if(tables.indexOf(db_karmatable)==-1){
            LOGGER.info('karmatable does not exist, creating now');
            r.tableCreate(db_karmatable).run(connection, function(err, result){
                if(err)
                    throw err;
                LOGGER.info('karmatable created');
            })
        }else{
            LOGGER.debug('karmatable exists')
        }
    })
};

var giveKarma = function(from, to){
    r.table(db_karmatable).insert({
        from:from,
        to:to,
        given:r.now()
    }).run(connection, function(err, result){
        if(err){
            LOGGER.error('saving karma from %s for %s: %s', from, to, err)
        }else{
            LOGGER.info('karma from %s for %s saved', from, to)
        }
    })
};

var getKarma = function(user, callback){
    r.table(db_karmatable).filter({"to":user}).count().run(connection, function(err, karma){
        if(err)
            throw err;
        callback(karma);
    });
};

var topKarma = function(callback){
    r.table(db_karmatable).
    groupBy("to", r.count).
    map(function(elem){
        return elem.merge({ "nick" : elem("group")("to"),
                            "karma" : elem("reduction")}).
                    pluck("nick", "karma")
    }).orderBy(r.desc("score")).
    limit(3).
    run(connection, function(err, data){
        if(err)
            throw err;
        callback(data.sort(function(a,b){return b.karma-a.karma}))
    })
};

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
    topKarma(function(karmanicks){
        karmanicks = karmanicks .map(function(u){return u.nick + ": " + u.karma})
                                .join(', ');
        that.reply(sender, to, karmanicks)
    });
}).helptext = "karma highscore";

var transfercnt = 1;
var transfers = {};
(COMMANDS["!transfer"] = function(sender, to, target){
    var that = this;
    getKarma(function(karma){
        if(karma==0)
            return
        var id = transfercnt;
        transfercnt++;
        var initdata = {
            blacklist:[sender, target],
            counter :0,
            target: target,
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
    getKarma(function(karma){
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
            giveKarma(sender, nick);
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
    initDb();
    for(key in FILTERS){
        bot.filters[key] = FILTERS[key];
    }
    return {commands:COMMANDS};
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

var getAlias = function(user, cb){

};